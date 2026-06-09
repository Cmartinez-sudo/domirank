-- ============================================================
-- 0064 — Fix notifications column names in 0060/0061 RPCs
-- ============================================================
-- Sprint Active Match Awareness — patch.
--
-- Bug detected: transfer_score_keeper (0060) and {propose,confirm,
-- reject}_hand_edit (0061) inserted into notifications using `kind`
-- and `match_id`. Actual columns (per 0016) are `type` and
-- `ref_match_id`. Functions parse fine but fail at runtime.
--
-- This migration re-creates the 4 RPCs with the correct column names.
-- Logic identical to the originals.
-- ============================================================

-- ─── transfer_score_keeper ───
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
  if v_caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select status into v_match_status from public.matches where id = p_match_id;
  if v_match_status is null then raise exception 'Match % not found', p_match_id using errcode = 'P0002'; end if;
  if v_match_status <> 'in_progress' then
    raise exception 'Cannot transfer score-keeper: match status is %, expected in_progress', v_match_status using errcode = 'P0001';
  end if;

  select user_id into v_current_keeper
    from public.match_score_keepers
   where match_id = p_match_id and active = true limit 1;

  if v_current_keeper is null then raise exception 'No active score-keeper for match %', p_match_id using errcode = 'P0002'; end if;
  if v_current_keeper <> v_caller then raise exception 'Only the current score-keeper can transfer this role' using errcode = '42501'; end if;
  if v_current_keeper = p_new_keeper_user_id then return; end if;

  if not exists (
    select 1 from public.match_players
     where match_id = p_match_id and user_id = p_new_keeper_user_id
  ) then
    raise exception 'User % is not a player in match %', p_new_keeper_user_id, p_match_id using errcode = 'P0001';
  end if;

  update public.match_score_keepers set active = false, ended_at = now()
   where match_id = p_match_id and active = true;

  insert into public.match_score_keepers (match_id, user_id, assigned_by_user_id, active)
  values (p_match_id, p_new_keeper_user_id, v_caller, true);

  update public.matches set scorekeeper_id = p_new_keeper_user_id where id = p_match_id;

  insert into public.notifications (user_id, type, ref_match_id, payload)
  values (p_new_keeper_user_id, 'score_keeper_received', p_match_id,
          jsonb_build_object('transferred_by', v_caller, 'match_id', p_match_id));
end;
$$;

-- ─── propose_hand_edit ───
create or replace function public.propose_hand_edit(
  p_round_id bigint,
  p_new_team int,
  p_new_points int,
  p_new_kind text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_round public.match_rounds%rowtype;
  v_match public.matches%rowtype;
  v_proposal_id uuid;
  v_other_player uuid;
begin
  if v_caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into v_round from public.match_rounds where id = p_round_id;
  if not found then raise exception 'Round not found' using errcode = 'P0002'; end if;
  select * into v_match from public.matches where id = v_round.match_id;
  if v_match.status <> 'in_progress' then raise exception 'Cannot propose edits on non-active match' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.match_players where match_id = v_match.id and user_id = v_caller) then
    raise exception 'Only match participants can propose edits' using errcode = '42501';
  end if;

  if exists (select 1 from public.match_hand_edit_proposals where round_id = p_round_id and status = 'pending') then
    raise exception 'Another edit proposal is already pending for this hand' using errcode = 'P0001';
  end if;

  insert into public.match_hand_edit_proposals
    (round_id, match_id, proposed_by_user_id,
     prev_team, prev_points, prev_kind,
     new_team, new_points, new_kind, confirmed_by)
  values
    (p_round_id, v_match.id, v_caller,
     v_round.team, v_round.points, v_round.kind,
     p_new_team, p_new_points, p_new_kind, array[v_caller])
  returning id into v_proposal_id;

  update public.match_rounds set attestation_required = true, attestation_status = 'pending' where id = p_round_id;

  for v_other_player in
    select user_id from public.match_players where match_id = v_match.id and user_id <> v_caller
  loop
    insert into public.notifications (user_id, type, ref_match_id, payload)
    values (v_other_player, 'hand_edit_proposed', v_match.id,
            jsonb_build_object('proposal_id', v_proposal_id, 'round_id', p_round_id, 'proposed_by', v_caller));
  end loop;

  return v_proposal_id;
end;
$$;

-- ─── confirm_hand_edit ───
create or replace function public.confirm_hand_edit(p_proposal_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_proposal public.match_hand_edit_proposals%rowtype;
begin
  if v_caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_proposal from public.match_hand_edit_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'pending' then return v_proposal.status; end if;

  if not exists (select 1 from public.match_players where match_id = v_proposal.match_id and user_id = v_caller) then
    raise exception 'Only match participants can confirm proposals' using errcode = '42501';
  end if;
  if v_caller = any(v_proposal.confirmed_by) then return 'already_confirmed'; end if;

  update public.match_hand_edit_proposals set confirmed_by = array_append(confirmed_by, v_caller) where id = p_proposal_id;

  if (array_length(v_proposal.confirmed_by, 1) + 1) >= 2 then
    update public.match_rounds r set
      team = v_proposal.new_team, points = v_proposal.new_points, kind = v_proposal.new_kind,
      last_edited_by_user_id = v_proposal.proposed_by_user_id, last_edited_at = now(),
      edit_count = edit_count + 1, attestation_required = false, attestation_status = 'approved'
     where r.id = v_proposal.round_id;

    update public.match_hand_edit_proposals set status = 'approved', resolved_at = now() where id = p_proposal_id;

    insert into public.notifications (user_id, type, ref_match_id, payload)
    values (v_proposal.proposed_by_user_id, 'hand_edit_approved', v_proposal.match_id,
            jsonb_build_object('proposal_id', p_proposal_id, 'round_id', v_proposal.round_id));

    return 'approved';
  end if;
  return 'pending';
end;
$$;

-- ─── reject_hand_edit ───
create or replace function public.reject_hand_edit(p_proposal_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_proposal public.match_hand_edit_proposals%rowtype;
begin
  if v_caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_proposal from public.match_hand_edit_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found' using errcode = 'P0002'; end if;
  if v_proposal.status <> 'pending' then return v_proposal.status; end if;

  if not exists (select 1 from public.match_players where match_id = v_proposal.match_id and user_id = v_caller) then
    raise exception 'Only match participants can reject proposals' using errcode = '42501';
  end if;
  if v_caller = any(v_proposal.rejected_by) then return 'already_rejected'; end if;

  update public.match_hand_edit_proposals set
    rejected_by = array_append(rejected_by, v_caller),
    status = 'rejected', resolved_at = now()
   where id = p_proposal_id;

  update public.match_rounds set attestation_required = false, attestation_status = 'rejected'
   where id = v_proposal.round_id;

  insert into public.notifications (user_id, type, ref_match_id, payload)
  values (v_proposal.proposed_by_user_id, 'hand_edit_rejected', v_proposal.match_id,
          jsonb_build_object('proposal_id', p_proposal_id, 'round_id', v_proposal.round_id, 'rejected_by', v_caller));

  return 'rejected';
end;
$$;

-- ─── Notify on match end (C10) ───
-- Notifica a todos los participantes que la partida terminó y deben firmar.
-- Llamable desde el server action finalizeMatch (post-RPC finalize_match).
create or replace function public.notify_match_ended(p_match_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_inserted int := 0;
  v_match record;
begin
  select id, scorekeeper_id, status into v_match from public.matches where id = p_match_id;
  if not found or v_match.status <> 'pending_attestation' then return 0; end if;

  with inserted as (
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id, 'match_ended', p_match_id,
           jsonb_build_object('scorekeeper_id', v_match.scorekeeper_id)
      from public.match_players mp
     where mp.match_id = p_match_id
       and mp.user_id <> coalesce(v_match.scorekeeper_id, '00000000-0000-0000-0000-000000000000'::uuid)
       -- Idempotency: skip si ya existe notif match_ended para este match-user.
       and not exists (
         select 1 from public.notifications n
          where n.user_id = mp.user_id
            and n.type = 'match_ended'
            and n.ref_match_id = p_match_id
       )
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

grant execute on function public.notify_match_ended(uuid) to authenticated;

comment on function public.notify_match_ended(uuid) is
  'Inserta una notification match_ended para cada participante del match (excepto el scorekeeper, que ya sabe). Idempotente — no duplica si ya existe.';
