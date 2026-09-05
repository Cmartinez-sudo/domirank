-- ============================================================
-- 0031 — Epic R Fixes (CRITICAL 1, CRITICAL 2, CRITICAL 4 partial)
-- ============================================================
-- Idempotente: usa IF NOT EXISTS, DROP … IF EXISTS, OR REPLACE, etc.
-- Requisito previo: 0027_tournament_pairs_wizard.sql ya aplicado.
-- ============================================================

-- ─── CRITICAL 1: Añadir 'code' al CHECK de visibility ───────

-- Soltar el constraint viejo (definido en 0006 como inline check)
alter table public.tournaments
  drop constraint if exists tournaments_visibility_check;

-- Reconstriur con los cuatro valores
alter table public.tournaments
  add constraint tournaments_visibility_check
  check (visibility in ('public', 'private', 'friends', 'code'));

-- Actualizar la policy de lectura para torneos con visibilidad 'code':
-- tratamos 'code' como 'private': solo el creador y los jugadores inscritos
-- pueden leerlo. El join por código ocurre ANTES de inscribirse, mediante
-- la función join_tournament_by_code (fuera del scope de este ticket).
-- Por eso NO lo exponemos en la policy de lectura general.

drop policy if exists tournaments_read_visible on public.tournaments;

create policy tournaments_read_visible on public.tournaments for select using (
  visibility = 'public'
  or created_by = auth.uid()
  or exists (
    select 1 from public.tournament_players tp
    where tp.tournament_id = id and tp.user_id = auth.uid()
  )
  or (
    visibility = 'friends' and exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = created_by
    )
  )
  -- 'code': solo organizador y jugadores ya inscritos (cubierto arriba)
);

-- ─── CRITICAL 2: RPC accept_pair_invite (security definer) ──

create or replace function public.accept_pair_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  -- Validar que el invite existe y pertenece al caller
  select * into v_invite
    from public.pair_invites
   where id = p_invite_id
     and invitee_id = auth.uid()
     and status = 'pending'
   for update;

  if not found then
    raise exception 'invite_not_found_or_not_invitee';
  end if;

  -- Verificar que el torneo sigue en 'open'
  if not exists (
    select 1 from public.tournaments
     where id = v_invite.tournament_id
       and status = 'open'
  ) then
    raise exception 'tournament_not_open';
  end if;

  -- Insertar al invitee como tournament_player (idempotente)
  insert into public.tournament_players (tournament_id, user_id)
    values (v_invite.tournament_id, v_invite.invitee_id)
    on conflict do nothing;

  -- Verificar que el inviter sigue inscrito
  if not exists (
    select 1 from public.tournament_players
     where tournament_id = v_invite.tournament_id
       and user_id = v_invite.inviter_id
  ) then
    raise exception 'inviter_no_longer_in_tournament';
  end if;

  -- Insertar el pair con orden canónico (user_a_id < user_b_id)
  insert into public.tournament_pairs (tournament_id, user_a_id, user_b_id)
    values (
      v_invite.tournament_id,
      least(v_invite.inviter_id::text, v_invite.invitee_id::text)::uuid,
      greatest(v_invite.inviter_id::text, v_invite.invitee_id::text)::uuid
    )
    on conflict (tournament_id, user_a_id) do nothing;

  -- Marcar el invite como aceptado
  update public.pair_invites
     set status = 'accepted', responded_at = now()
   where id = p_invite_id;

  -- Cancelar otros invites pending del mismo inviter o invitee en el mismo torneo
  update public.pair_invites
     set status = 'cancelled', responded_at = now()
   where tournament_id = v_invite.tournament_id
     and status = 'pending'
     and (
       inviter_id = v_invite.inviter_id
       or invitee_id = v_invite.invitee_id
       or inviter_id = v_invite.invitee_id
       or invitee_id = v_invite.inviter_id
     )
     and id <> p_invite_id;
end;
$$;

grant execute on function public.accept_pair_invite(uuid) to authenticated;

-- ─── CRITICAL 4 partial: RPC link_match_to_pairing ──────────

create or replace function public.link_match_to_pairing(
  p_pairing_id bigint,
  p_match_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing record;
begin
  -- Obtener el pairing y verificar que existe
  select * into v_pairing
    from public.tournament_pairings
   where id = p_pairing_id
   for update;

  if not found then
    raise exception 'pairing_not_found';
  end if;

  -- Verificar que el caller es uno de los jugadores del pairing
  if not (
    auth.uid() = any(v_pairing.team_a_user_ids)
    or auth.uid() = any(v_pairing.team_b_user_ids)
  ) then
    raise exception 'not_a_player_of_this_pairing';
  end if;

  -- Verificar que el match existe y pertenece al torneo correcto
  if not exists (
    select 1 from public.matches
     where id = p_match_id
       and tournament_id = v_pairing.tournament_id
  ) then
    raise exception 'match_not_in_tournament';
  end if;

  -- Vincular (idempotente si ya tiene el mismo match_id)
  update public.tournament_pairings
     set match_id = p_match_id
   where id = p_pairing_id;
end;
$$;

grant execute on function public.link_match_to_pairing(bigint, uuid) to authenticated;
