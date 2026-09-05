-- ============================================================
-- 0072 — cancel_match security hardening + trigger DELETE + notif types
-- ============================================================
-- Sprint Match Cancellation — fixes post-review.
--
-- Tres correcciones críticas detectadas en code review de PR #16:
--
--   1. PRIVILEGE ESCALATION en cancel_match:
--        El RPC aceptaba p_reason del caller. El participant check solo
--        disparaba cuando p_reason='user_cancelled'. Un atacante podía
--        llamar cancel_match(uuid, 'inactivity_auto') desde un client
--        autenticado y bypassear el guard de participante → cancelar
--        cualquier match de cualquier user. Fix: cuando auth.uid() no es
--        NULL (= llamada de un user con JWT), FORZAMOS
--        p_reason='user_cancelled'. Las reasons sistémicas solo se
--        respetan cuando auth.uid() es NULL, lo cual ocurre solo con
--        service_role (cron + admin scripts).
--
--   2. Trigger tg_touch_match_on_round_activity NO bumpeaba en DELETE.
--        AFTER INSERT OR UPDATE en match_rounds. Pero undoLastRound
--        DELETE-a la última mano. Sin bump en DELETE, deshacer una mano
--        no contaba como actividad → cron auto-cancel podía flaggear el
--        match como zombie prematuramente. Fix: extender a INSERT OR
--        UPDATE OR DELETE.
--
--   3. notifications.type check constraint (mig 0016) no incluye los
--        nuevos types ('match_cancelled', 'match_cancellation_undone',
--        'match_inactivity_warning'). Si el constraint sigue activo, el
--        INSERT a notifications dentro de cancel_match falla y la
--        transacción rollbackea → cancel entero falla.
--        Fix defensivo: DROP CONSTRAINT IF EXISTS notifications_type_check.
--        (mig 0064 de PR #15 hace lo mismo; idempotente).
--
-- Dependencias: 0066, 0067.
-- ============================================================

-- ───── FIX 1: cancel_match security hardening ─────
-- Reescribir el RPC con el guard correcto. Logic intacta salvo el
-- branch p_reason → siempre user_cancelled cuando hay JWT.

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
  v_effective_reason text;
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

  -- HARDENING: un caller con JWT (auth.uid IS NOT NULL) SIEMPRE es
  -- tratado como cancelación de usuario. p_reason no se honra desde
  -- clients — fuerzaríamos 'user_cancelled' y exigimos participant check.
  -- Las reasons sistémicas (inactivity_auto, migration_cleanup,
  -- replaced_by_new_match) solo se respetan cuando v_caller IS NULL,
  -- lo que ocurre exclusivamente vía service_role (cron + scripts).
  if v_caller is not null then
    v_effective_reason := 'user_cancelled';

    select exists (
      select 1 from public.match_players
       where match_id = p_match_id and user_id = v_caller
    ) into v_is_participant;
    if not v_is_participant then
      raise exception 'Only participants can cancel a match' using errcode = '42501';
    end if;
  else
    -- service_role path. Validar que la reason esté en el enum permitido.
    if p_reason not in ('inactivity_auto', 'migration_cleanup', 'replaced_by_new_match', 'host_no_show') then
      raise exception 'Invalid system reason: %', p_reason using errcode = '22023';
    end if;
    v_effective_reason := p_reason;
  end if;

  -- Solo user_cancelled tiene undo window. Sistémicas son finales.
  v_undo_until := case
    when v_effective_reason = 'user_cancelled' then now() + interval '5 minutes'
    else null
  end;

  update public.matches set
    status                  = 'cancelled',
    cancelled_at            = now(),
    cancelled_by_user_id    = v_caller,
    cancellation_reason     = v_effective_reason,
    cancellation_undo_until = v_undo_until
   where id = p_match_id;

  -- Audit.
  insert into public.match_cancellation_events (match_id, action, actor_user_id, reason)
  values (p_match_id, 'cancelled', v_caller, v_effective_reason);

  -- In-app notif a otros participants.
  if v_effective_reason in ('user_cancelled', 'inactivity_auto') then
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
          'reason', v_effective_reason,
          'undo_until', v_undo_until
        )
      );
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'undo_until', v_undo_until,
    'reason', v_effective_reason
  );
end;
$$;

comment on function public.cancel_match(uuid, text) is
  'Soft-delete a match. SECURITY: callers with JWT (auth.uid NOT NULL) always treated as user_cancelled regardless of p_reason — participant check enforced. System reasons honored only via service_role (auth.uid IS NULL).';

-- ───── FIX 2: trigger fires on DELETE too ─────

drop trigger if exists trg_match_rounds_touch_match on public.match_rounds;

create trigger trg_match_rounds_touch_match
  after insert or update or delete on public.match_rounds
  for each row
  execute function public.tg_touch_match_on_round_activity();

-- ───── FIX 3: notifications.type constraint defensive drop ─────
-- mig 0064 (en feature/active-match-awareness) ya lo dropea, pero como
-- esa branch puede mergear después o nunca, lo hacemos defensive acá.
-- Idempotente: IF EXISTS.

alter table public.notifications drop constraint if exists notifications_type_check;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Security: un user no-participant que intenta
--      select cancel_match('<other-users-match>', 'inactivity_auto')
--    debe fallar con "Only participants can cancel a match".
--
-- 2. DELETE bumpea updated_at:
--      DELETE FROM match_rounds WHERE id = X;
--      → matches.updated_at del match correspondiente avanza.
--
-- 3. Cancel ya no rollbackea por notif type check:
--      cancel_match dispara notif type='match_cancelled' sin error.
-- ============================================================
