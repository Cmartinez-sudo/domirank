-- ============================================================
-- 0061 — Hand-edit proposals (attestation flow for late edits)
-- ============================================================
-- Sprint Active Match Awareness — C6.
--
-- Cuando un user que NO es autor (>5min) y NO es creator quiere
-- corregir una mano, abre una "proposal". Otro player debe confirmar
-- (1 confirmación adicional → 2 votos = aplica). Si nadie confirma
-- en 10 minutos, la proposal expira.
--
-- match_hand_edit_proposals:
--   id, round_id, proposed_by_user_id, new_team, new_points, new_kind,
--   confirmed_by uuid[], rejected_by uuid[], status ('pending'/'approved'/
--   'rejected'/'expired'), created_at, resolved_at.
--
-- Funciones:
--   • propose_hand_edit — crea la proposal + notifica a otros players.
--   • confirm_hand_edit — añade a confirmed_by; si llega a >= 1 confirm
--     (proposer cuenta como auto-vote), aplica el cambio.
--   • reject_hand_edit — añade a rejected_by; si >= 1 rejection,
--     status='rejected', no aplica.
--   • expire_old_hand_edit_proposals — cron-callable, set status='expired'
--     a proposals con created_at < now() - 10 min.
--
-- Dependencias: 0057 (match_rounds + attribution), 0058 (can_edit_hand),
-- 0016 (notifications).
-- ============================================================

create table if not exists public.match_hand_edit_proposals (
  id uuid primary key default gen_random_uuid(),
  round_id bigint not null references public.match_rounds(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  proposed_by_user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot del valor ORIGINAL para diff visual
  prev_team int not null,
  prev_points int not null,
  prev_kind text not null,
  -- Nuevo valor propuesto
  new_team int not null,
  new_points int not null check (new_points >= 0),
  new_kind text not null check (new_kind in ('points','capicua','tranque')),
  -- Votos
  confirmed_by uuid[] not null default '{}',
  rejected_by uuid[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_hand_edit_proposals_round
  on public.match_hand_edit_proposals (round_id);
create index if not exists idx_hand_edit_proposals_pending
  on public.match_hand_edit_proposals (match_id, status)
  where status = 'pending';

alter table public.match_hand_edit_proposals enable row level security;

-- SELECT: participantes del match.
create policy hand_edit_select_participants
  on public.match_hand_edit_proposals for select
  using (
    exists (
      select 1 from public.match_players mp
       where mp.match_id = match_hand_edit_proposals.match_id
         and mp.user_id = auth.uid()
    )
  );

-- INSERT solo via RPC (no client direct).
-- (No policy → blocked. Las RPC son security definer.)

-- ─────────────────────────────────────────────────────────────
-- RPC: propose_hand_edit
-- ─────────────────────────────────────────────────────────────
create or replace function public.propose_hand_edit(
  p_round_id bigint,
  p_new_team int,
  p_new_points int,
  p_new_kind text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_round public.match_rounds%rowtype;
  v_match public.matches%rowtype;
  v_proposal_id uuid;
  v_other_player uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_round from public.match_rounds where id = p_round_id;
  if not found then raise exception 'Round not found' using errcode = 'P0002'; end if;

  select * into v_match from public.matches where id = v_round.match_id;
  if v_match.status <> 'in_progress' then
    raise exception 'Cannot propose edits on non-active match' using errcode = 'P0001';
  end if;

  -- Caller debe ser participante.
  if not exists (
    select 1 from public.match_players
     where match_id = v_match.id and user_id = v_caller
  ) then
    raise exception 'Only match participants can propose edits' using errcode = '42501';
  end if;

  -- Anti-duplicate: si hay una proposal pending para este round, fallar.
  if exists (
    select 1 from public.match_hand_edit_proposals
     where round_id = p_round_id and status = 'pending'
  ) then
    raise exception 'Another edit proposal is already pending for this hand'
      using errcode = 'P0001';
  end if;

  insert into public.match_hand_edit_proposals
    (round_id, match_id, proposed_by_user_id,
     prev_team, prev_points, prev_kind,
     new_team, new_points, new_kind,
     confirmed_by)
  values
    (p_round_id, v_match.id, v_caller,
     v_round.team, v_round.points, v_round.kind,
     p_new_team, p_new_points, p_new_kind,
     array[v_caller])  -- proposer counts as 1 vote
  returning id into v_proposal_id;

  -- Mark the round as attestation_required.
  update public.match_rounds
     set attestation_required = true,
         attestation_status = 'pending'
   where id = p_round_id;

  -- Notify other participants.
  for v_other_player in
    select user_id from public.match_players
     where match_id = v_match.id
       and user_id <> v_caller
  loop
    insert into public.notifications (user_id, kind, match_id, payload)
    values (
      v_other_player,
      'hand_edit_proposed',
      v_match.id,
      jsonb_build_object(
        'proposal_id', v_proposal_id,
        'round_id', p_round_id,
        'proposed_by', v_caller
      )
    );
  end loop;

  return v_proposal_id;
end;
$$;

comment on function public.propose_hand_edit(bigint, int, int, text) is
  'Creates a hand-edit proposal. Notifies other participants. Requires 1+ confirmation to apply.';

grant execute on function public.propose_hand_edit(bigint, int, int, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC: confirm_hand_edit
-- ─────────────────────────────────────────────────────────────
create or replace function public.confirm_hand_edit(
  p_proposal_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_proposal public.match_hand_edit_proposals%rowtype;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_proposal from public.match_hand_edit_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'pending' then return v_proposal.status; end if;

  -- Caller debe ser participante.
  if not exists (
    select 1 from public.match_players
     where match_id = v_proposal.match_id and user_id = v_caller
  ) then
    raise exception 'Only match participants can confirm proposals' using errcode = '42501';
  end if;

  if v_caller = any(v_proposal.confirmed_by) then
    return 'already_confirmed';
  end if;

  -- Add to confirmed_by.
  update public.match_hand_edit_proposals
     set confirmed_by = array_append(confirmed_by, v_caller)
   where id = p_proposal_id;

  -- Threshold: 2 votos = aplicar (proposer + 1 confirm).
  -- v_proposal.confirmed_by ya tiene al proposer; añadir uno más = 2.
  if (array_length(v_proposal.confirmed_by, 1) + 1) >= 2 then
    -- Apply the edit.
    update public.match_rounds r
       set team = v_proposal.new_team,
           points = v_proposal.new_points,
           kind = v_proposal.new_kind,
           last_edited_by_user_id = v_proposal.proposed_by_user_id,
           last_edited_at = now(),
           edit_count = edit_count + 1,
           attestation_required = false,
           attestation_status = 'approved'
     where r.id = v_proposal.round_id;

    update public.match_hand_edit_proposals
       set status = 'approved', resolved_at = now()
     where id = p_proposal_id;

    -- Notify proposer.
    insert into public.notifications (user_id, kind, match_id, payload)
    values (
      v_proposal.proposed_by_user_id,
      'hand_edit_approved',
      v_proposal.match_id,
      jsonb_build_object('proposal_id', p_proposal_id, 'round_id', v_proposal.round_id)
    );

    return 'approved';
  end if;

  return 'pending';
end;
$$;

grant execute on function public.confirm_hand_edit(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC: reject_hand_edit
-- ─────────────────────────────────────────────────────────────
create or replace function public.reject_hand_edit(
  p_proposal_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_proposal public.match_hand_edit_proposals%rowtype;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_proposal from public.match_hand_edit_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'pending' then return v_proposal.status; end if;

  if not exists (
    select 1 from public.match_players
     where match_id = v_proposal.match_id and user_id = v_caller
  ) then
    raise exception 'Only match participants can reject proposals' using errcode = '42501';
  end if;

  if v_caller = any(v_proposal.rejected_by) then return 'already_rejected'; end if;

  -- Cualquier rejection cierra la proposal.
  update public.match_hand_edit_proposals
     set rejected_by = array_append(rejected_by, v_caller),
         status = 'rejected',
         resolved_at = now()
   where id = p_proposal_id;

  -- Clear attestation flag on the round.
  update public.match_rounds
     set attestation_required = false,
         attestation_status = 'rejected'
   where id = v_proposal.round_id;

  -- Notify proposer.
  insert into public.notifications (user_id, kind, match_id, payload)
  values (
    v_proposal.proposed_by_user_id,
    'hand_edit_rejected',
    v_proposal.match_id,
    jsonb_build_object('proposal_id', p_proposal_id, 'round_id', v_proposal.round_id, 'rejected_by', v_caller)
  );

  return 'rejected';
end;
$$;

grant execute on function public.reject_hand_edit(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC: expire_old_hand_edit_proposals (cron-callable)
-- ─────────────────────────────────────────────────────────────
create or replace function public.expire_old_hand_edit_proposals(p_window_minutes int default 10)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update public.match_hand_edit_proposals
       set status = 'expired', resolved_at = now()
     where status = 'pending'
       and created_at < now() - (p_window_minutes || ' minutes')::interval
     returning round_id
  ),
  cleared as (
    update public.match_rounds r
       set attestation_required = false,
           attestation_status = null
      from expired e
     where r.id = e.round_id
     returning r.id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

grant execute on function public.expire_old_hand_edit_proposals(int) to authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Tabla + RLS:
--      select * from pg_policy where polrelid = 'public.match_hand_edit_proposals'::regclass;
--    Esperado: 1 policy (select).
-- 2. RPCs:
--      select proname from pg_proc where proname like '%hand_edit%';
--    Esperado: 4 funciones.
-- ============================================================
