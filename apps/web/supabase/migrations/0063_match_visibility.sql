-- ============================================================
-- 0063 — matches.visibility + spectator-friendly RLS
-- ============================================================
-- Sprint Active Match Awareness — C9.
--
-- Adds `visibility` column ('private' | 'friends' | 'public') to matches
-- following the same pattern used in `tournaments`. Default = 'private'.
-- Public matches can be read by any authenticated user; friends-only
-- can be read by friends of the host.
--
-- match_rounds RLS already permits read for participants. We extend
-- the SELECT policy to also allow reads when the parent match is
-- visibility='public'. Friends-only requires a join into `friendships`
-- which exists from earlier sprints.
--
-- Dependencias: 0001 (matches), 0058 (match_rounds RLS), friendships table.
-- ============================================================

alter table public.matches
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private','friends','public'));

create index if not exists idx_matches_visibility
  on public.matches (visibility) where visibility <> 'private';

comment on column public.matches.visibility is
  'Spectator visibility: private (default, only participants), friends (host+participants+friends-of-creator), public (any authenticated user can read).';

-- Backfill explícito (aunque default cubre, dejarlo explícito por audit).
update public.matches set visibility = 'private' where visibility is null;

-- ─────────────────────────────────────────────────────────────
-- Function: can_spectate_match
-- ─────────────────────────────────────────────────────────────
-- Helper centralizado para evaluar si un user puede ver un match
-- como espectador (no-participant). Usado por RLS de match_rounds
-- y, en el cliente, para mostrar/ocultar UI read-only.
create or replace function public.can_spectate_match(
  p_match_id uuid,
  p_user_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
     where m.id = p_match_id
       and (
         m.visibility = 'public'
         or (m.visibility = 'friends' and public.are_friends(m.created_by, p_user_id))
       )
  )
$$;

grant execute on function public.can_spectate_match(uuid, uuid) to authenticated;

comment on function public.can_spectate_match(uuid, uuid) is
  'True if the user is not a participant but is allowed to spectate the match (public visibility or friends-of-creator).';

-- ─────────────────────────────────────────────────────────────
-- Extend match_rounds SELECT policy to cover spectators
-- ─────────────────────────────────────────────────────────────
-- The existing match_rounds_read_all policy (mig 0005) is read=true.
-- That means *any* authenticated user can read all rounds. That was
-- fine when matches were assumed public; with visibility introduced
-- we tighten to participants + spectators-of-visible.

drop policy if exists match_rounds_read_all on public.match_rounds;

create policy match_rounds_read_participants_or_spectators
  on public.match_rounds for select
  using (
    -- participant
    exists (
      select 1 from public.match_players mp
       where mp.match_id = match_rounds.match_id
         and mp.user_id = auth.uid()
    )
    -- OR spectator-allowed
    or public.can_spectate_match(match_rounds.match_id, auth.uid())
  );

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Column exists:
--      select column_name, data_type from information_schema.columns
--       where table_schema='public' and table_name='matches' and column_name='visibility';
-- 2. Function exists:
--      select proname from pg_proc where proname='can_spectate_match';
-- 3. New RLS:
--      select polname from pg_policy where polrelid='public.match_rounds'::regclass;
-- ============================================================
