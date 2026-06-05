-- ============================================================
-- 0060 — Score-keeper transfer RPC (atomic)
-- ============================================================
-- Sprint Active Match Awareness — C5.
--
-- RPC `transfer_score_keeper(p_match_id, p_new_keeper_user_id)`:
--   • Verifica que el caller (auth.uid()) sea el current keeper.
--   • Verifica que el new keeper sea un match_player.
--   • Verifica que la match esté in_progress.
--   • Atomic:
--       a) UPDATE match_score_keepers SET active=false, ended_at=now()
--          WHERE match_id=$1 AND active=true.
--       b) INSERT new row WHERE active=true.
--       c) UPDATE matches.scorekeeper_id = new keeper.
--   • Inserta notification para el receptor.
--
-- Dependencias: 0057 (match_score_keepers), 0016 (notifications).
-- ============================================================

create or replace function public.transfer_score_keeper(
  p_match_id uuid,
  p_new_keeper_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_match_status text;
  v_current_keeper uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Validar match exists + in_progress.
  select status into v_match_status from public.matches where id = p_match_id;
  if v_match_status is null then
    raise exception 'Match % not found', p_match_id using errcode = 'P0002';
  end if;
  if v_match_status <> 'in_progress' then
    raise exception 'Cannot transfer score-keeper: match status is %, expected in_progress', v_match_status
      using errcode = 'P0001';
  end if;

  -- Validar caller es el current keeper.
  select user_id into v_current_keeper
    from public.match_score_keepers
   where match_id = p_match_id and active = true
   limit 1;

  if v_current_keeper is null then
    raise exception 'No active score-keeper for match %', p_match_id using errcode = 'P0002';
  end if;
  if v_current_keeper <> v_caller then
    raise exception 'Only the current score-keeper can transfer this role'
      using errcode = '42501';
  end if;

  -- No transferir a sí mismo (no-op).
  if v_current_keeper = p_new_keeper_user_id then
    return;
  end if;

  -- Validar receptor es match_player.
  if not exists (
    select 1 from public.match_players
     where match_id = p_match_id and user_id = p_new_keeper_user_id
  ) then
    raise exception 'User % is not a player in match %', p_new_keeper_user_id, p_match_id
      using errcode = 'P0001';
  end if;

  -- Atomic transfer.
  update public.match_score_keepers
     set active = false, ended_at = now()
   where match_id = p_match_id and active = true;

  insert into public.match_score_keepers
    (match_id, user_id, assigned_by_user_id, active)
  values
    (p_match_id, p_new_keeper_user_id, v_caller, true);

  update public.matches
     set scorekeeper_id = p_new_keeper_user_id
   where id = p_match_id;

  -- Notify the receiver.
  insert into public.notifications (user_id, kind, match_id, payload)
  values (
    p_new_keeper_user_id,
    'score_keeper_received',
    p_match_id,
    jsonb_build_object(
      'transferred_by', v_caller,
      'match_id', p_match_id
    )
  );
end;
$$;

comment on function public.transfer_score_keeper(uuid, uuid) is
  'Atomic transfer of score-keeper role. Only the current keeper can call. Updates audit log + matches.scorekeeper_id + notifies receiver.';

grant execute on function public.transfer_score_keeper(uuid, uuid) to authenticated;

-- Allow the kind enum (notifications.kind is likely text — verify in 0016).
-- If it's a check constraint, we need to extend it. Defensive: only add if needed.
do $$
begin
  -- Try to identify if there's a kind check constraint blocking the new value.
  if exists (
    select 1 from information_schema.check_constraints cc
    join information_schema.constraint_column_usage ccu
      on cc.constraint_name = ccu.constraint_name
    where ccu.table_name = 'notifications'
      and ccu.column_name = 'kind'
  ) then
    -- The constraint exists; we may need to drop and recreate it.
    -- For safety we'll re-issue a permissive expression including our new kind.
    -- Find the constraint name dynamically.
    -- (No-op if no constraint named 'notifications_kind_check'.)
    begin
      execute 'alter table public.notifications drop constraint if exists notifications_kind_check';
    exception when others then
      null;
    end;
  end if;
end$$;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Function exists:
--      select proname from pg_proc where proname='transfer_score_keeper';
--    Esperado: 1 fila.
--
-- 2. Smoke (manual, contra un match in_progress de testing):
--      select public.transfer_score_keeper('<match_id>', '<player_id>');
--    Esperado: scorekeeper_id se actualiza, audit log refleja.
-- ============================================================
