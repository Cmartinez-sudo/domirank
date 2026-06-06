-- ============================================================
-- 0067 — Cancel / Undo RPCs + match_rounds activity trigger
-- ============================================================
-- Sprint Match Cancellation — F2.
--
--   • cancel_match(p_match_id, p_reason) → jsonb
--   • undo_cancellation(p_match_id) → jsonb
--   • finalize_expired_cancellations() → int  (cron-callable)
--   • trigger on match_rounds INSERT/UPDATE → matches.updated_at = now()
--
-- Dependencias: 0066 (schema).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Trigger: match_rounds activity → matches.updated_at
-- ─────────────────────────────────────────────────────────────
-- Cuando se mete o edita una mano, marcamos el match como "activo".
-- Sin esto, el cron auto-cleanup no detecta partidas con actividad
-- reciente (updated_at se quedaría en el created_at).

create or replace function public.tg_touch_match_on_round_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matches
     set updated_at = now()
   where id = coalesce(new.match_id, old.match_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_match_rounds_touch_match on public.match_rounds;

create trigger trg_match_rounds_touch_match
  after insert or update on public.match_rounds
  for each row
  execute function public.tg_touch_match_on_round_activity();

-- ─────────────────────────────────────────────────────────────
-- RPC: cancel_match
-- ─────────────────────────────────────────────────────────────
-- Reglas:
--   • Status válido: in_progress | pending_attestation. confirmed,
--     disputed, void, cancelled rechazan.
--   • Reason 'user_cancelled' → caller debe ser match_player.
--   • Reasons sistémicas (inactivity_auto, migration_cleanup,
--     replaced_by_new_match) → no requieren participant check.
--   • Soft delete: status='cancelled' + cancelled_at + cancelled_by
--     + reason. cancellation_undo_until = now() + 5min SOLO para
--     'user_cancelled' (las sistémicas no son undoable).
--   • Inserta audit en match_cancellation_events.
--   • Notifica a otros participants vía notifications (in-app).
--
-- Idempotente: si ya está cancelled, retorna success false con razón.

create or replace function public.cancel_match(
  p_match_id uuid,
  p_reason text default 'user_cancelled'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_match public.matches%rowtype;
  v_undo_until timestamptz;
  v_other_player uuid;
  v_is_participant boolean;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match % not found', p_match_id using errcode = 'P0002';
  end if;

  if v_match.status not in ('in_progress', 'pending_attestation') then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_status',
      'message', format('Cannot cancel match in status %L', v_match.status)
    );
  end if;

  -- User-initiated cancellations: caller must be a participant.
  if p_reason = 'user_cancelled' then
    if v_caller is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    select exists (
      select 1 from public.match_players
       where match_id = p_match_id and user_id = v_caller
    ) into v_is_participant;
    if not v_is_participant then
      raise exception 'Only participants can cancel a match' using errcode = '42501';
    end if;
  end if;

  -- Only user_cancelled gets an undo window. Systemic cancels
  -- (inactivity_auto, migration_cleanup, replaced_by_new_match) are final.
  v_undo_until := case
    when p_reason = 'user_cancelled' then now() + interval '5 minutes'
    else null
  end;

  update public.matches set
    status                  = 'cancelled',
    cancelled_at            = now(),
    cancelled_by_user_id    = v_caller,
    cancellation_reason     = p_reason,
    cancellation_undo_until = v_undo_until
   where id = p_match_id;

  -- Audit.
  insert into public.match_cancellation_events (match_id, action, actor_user_id, reason)
  values (p_match_id, 'cancelled', v_caller, p_reason);

  -- In-app notif to OTHER participants (not the canceller, who already knows).
  if p_reason in ('user_cancelled', 'inactivity_auto') then
    for v_other_player in
      select user_id from public.match_players
       where match_id = p_match_id
         and (v_caller is null or user_id <> v_caller)
    loop
      insert into public.notifications (user_id, type, ref_match_id, payload)
      values (
        v_other_player,
        'match_cancelled',
        p_match_id,
        jsonb_build_object(
          'cancelled_by', v_caller,
          'reason', p_reason,
          'undo_until', v_undo_until
        )
      );
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'undo_until', v_undo_until,
    'reason', p_reason
  );
end;
$$;

grant execute on function public.cancel_match(uuid, text) to authenticated;

comment on function public.cancel_match(uuid, text) is
  'Soft-delete a match. Only participants can call with reason=user_cancelled. Systemic reasons (inactivity_auto, migration_cleanup, replaced_by_new_match) skip participant check. Returns {ok, undo_until, reason}.';

-- ─────────────────────────────────────────────────────────────
-- RPC: undo_cancellation
-- ─────────────────────────────────────────────────────────────
-- Solo participants pueden hacer undo. Solo dentro de la ventana
-- cancellation_undo_until. Restaura status según si hay rounds:
--   • rounds > 0 → 'in_progress'
--   • rounds = 0 → 'in_progress' (DomiRank no tiene 'scheduled')

create or replace function public.undo_cancellation(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_match public.matches%rowtype;
  v_is_participant boolean;
  v_other_player uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match % not found', p_match_id using errcode = 'P0002';
  end if;

  if v_match.status <> 'cancelled' then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_cancelled',
      'message', format('Match is in status %L, not cancelled', v_match.status)
    );
  end if;

  if v_match.cancellation_undo_until is null
     or v_match.cancellation_undo_until < now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'undo_window_expired',
      'message', 'The 5-minute undo window has expired.'
    );
  end if;

  select exists (
    select 1 from public.match_players
     where match_id = p_match_id and user_id = v_caller
  ) into v_is_participant;
  if not v_is_participant then
    raise exception 'Only participants can undo cancellation' using errcode = '42501';
  end if;

  update public.matches set
    status                  = 'in_progress',
    cancelled_at            = null,
    cancelled_by_user_id    = null,
    cancellation_reason     = null,
    cancellation_undo_until = null
   where id = p_match_id;

  insert into public.match_cancellation_events (match_id, action, actor_user_id)
  values (p_match_id, 'undone', v_caller);

  -- Notify other participants that the cancellation was reverted.
  for v_other_player in
    select user_id from public.match_players
     where match_id = p_match_id and user_id <> v_caller
  loop
    insert into public.notifications (user_id, type, ref_match_id, payload)
    values (
      v_other_player,
      'match_cancellation_undone',
      p_match_id,
      jsonb_build_object('reverted_by', v_caller)
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.undo_cancellation(uuid) to authenticated;

comment on function public.undo_cancellation(uuid) is
  'Reverses a cancellation within the 5-min undo window. Only participants. Restores status=in_progress.';

-- ─────────────────────────────────────────────────────────────
-- RPC: finalize_expired_cancellations (cron-callable)
-- ─────────────────────────────────────────────────────────────
-- Limpia el undo_until de matches cancelled cuya ventana ya pasó.
-- Después de esto, el cancel es definitivo (UI muestra banner muted).

create or replace function public.finalize_expired_cancellations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with finalized as (
    update public.matches
       set cancellation_undo_until = null
     where status = 'cancelled'
       and cancellation_undo_until is not null
       and cancellation_undo_until < now()
     returning id
  ),
  audit as (
    insert into public.match_cancellation_events (match_id, action, reason)
    select id, 'finalized', 'undo_window_expired' from finalized
    returning 1
  )
  select count(*) into v_count from audit;
  return v_count;
end;
$$;

grant execute on function public.finalize_expired_cancellations() to authenticated;

comment on function public.finalize_expired_cancellations() is
  'Cron-callable: cierra cancellations cuya ventana de undo (5min) ya pasó. Setea undo_until=NULL y loggea audit action=finalized.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Trigger en match_rounds:
--      INSERT into match_rounds → matches.updated_at debe avanzar.
--
-- 2. cancel_match smoke:
--      select * from public.cancel_match('<some-match-id>', 'user_cancelled');
--    Esperado: jsonb {ok:true, undo_until: <now+5min>, reason: ...}
--
-- 3. undo_cancellation smoke:
--      select * from public.undo_cancellation('<just-cancelled-id>');
--    Esperado: jsonb {ok:true}
--
-- 4. finalize_expired:
--      select public.finalize_expired_cancellations();
--    Esperado: int >= 0
-- ============================================================
