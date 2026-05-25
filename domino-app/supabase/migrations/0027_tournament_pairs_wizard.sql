-- ============================================================
-- 0027 — Tournament Wizard (R2) + Pair Management (R5)
-- ============================================================
-- Idempotente: usa IF NOT EXISTS, DROP POLICY IF EXISTS, etc.
-- Patrón: mismo que 0026_push_subscriptions.sql

-- ─── 1. Columnas nuevas en tournaments ──────────────────────
alter table public.tournaments
  add column if not exists inscription_mode text
    not null default 'pre_formed'
    check (inscription_mode in ('pre_formed', 'individual_manual')),
  add column if not exists time_limit_minutes int,
  add column if not exists join_code text,
  add column if not exists description text;

-- Índice parcial para búsqueda por código
create index if not exists idx_tournaments_join_code
  on public.tournaments(join_code) where join_code is not null;

-- Constraint único en join_code (nulls no compiten entre sí en Postgres)
alter table public.tournaments
  drop constraint if exists tournaments_join_code_unique;

alter table public.tournaments
  add constraint tournaments_join_code_unique unique (join_code);

-- ─── 2. Expandir constraint de status ───────────────────────
-- IMPORTANTE: hay que soltar el constraint viejo ANTES de hacer el UPDATE,
-- porque el constraint actual no permite 'in_progress' ni 'open'. Si
-- corremos el UPDATE primero, viola el CHECK.

alter table public.tournaments
  drop constraint if exists tournaments_status_check;

-- Ahora sí podemos migrar 'active' a su nuevo valor según tenga o no
-- pairings asignados.
update public.tournaments
  set status = case
    when status = 'active' and exists (
      select 1 from public.tournament_pairings
      where tournament_id = public.tournaments.id
    ) then 'in_progress'
    when status = 'active' then 'open'
    else status
  end
  where status = 'active';

alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('draft', 'open', 'in_progress', 'finished', 'archived', 'cancelled'));

-- ─── 3. tournament_pairs ────────────────────────────────────
create table if not exists public.tournament_pairs (
  id            bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_a_id     uuid not null references auth.users(id) on delete cascade,
  user_b_id     uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- Canonical order: user_a_id < user_b_id garantiza unicidad de pareja
  constraint tournament_pairs_order check (user_a_id < user_b_id),
  constraint tournament_pairs_unique_a unique (tournament_id, user_a_id),
  constraint tournament_pairs_unique_b unique (tournament_id, user_b_id)
);

create index if not exists idx_tournament_pairs_tournament
  on public.tournament_pairs(tournament_id);

alter table public.tournament_pairs enable row level security;

-- Políticas para tournament_pairs
drop policy if exists "tournament_pairs_read_all"         on public.tournament_pairs;
drop policy if exists "tournament_pairs_write_organizer"  on public.tournament_pairs;

create policy "tournament_pairs_read_all"
  on public.tournament_pairs for select to authenticated
  using (true);

create policy "tournament_pairs_write_organizer"
  on public.tournament_pairs for all to authenticated
  using (
    exists (
      select 1 from public.tournaments
      where id = tournament_id and created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tournaments
      where id = tournament_id and created_by = auth.uid()
    )
  );

-- ─── 4. pair_invites ────────────────────────────────────────
create table if not exists public.pair_invites (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_id    uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint pair_invites_unique unique (tournament_id, inviter_id, invitee_id)
);

create index if not exists idx_pair_invites_invitee
  on public.pair_invites(invitee_id, status);

create index if not exists idx_pair_invites_tournament
  on public.pair_invites(tournament_id);

alter table public.pair_invites enable row level security;

-- Políticas para pair_invites
drop policy if exists "pair_invites_read_participants"  on public.pair_invites;
drop policy if exists "pair_invites_insert_inviter"     on public.pair_invites;
drop policy if exists "pair_invites_update_invitee"     on public.pair_invites;

create policy "pair_invites_read_participants"
  on public.pair_invites for select to authenticated
  using (auth.uid() in (inviter_id, invitee_id));

create policy "pair_invites_insert_inviter"
  on public.pair_invites for insert to authenticated
  with check (inviter_id = auth.uid());

-- El invitee puede actualizar (aceptar / rechazar)
create policy "pair_invites_update_invitee"
  on public.pair_invites for update to authenticated
  using (invitee_id = auth.uid())
  with check (invitee_id = auth.uid());

-- ============================================================
-- PASOS MANUALES POST-MIGRACIÓN
-- 1. Aplicar esta migración en Supabase SQL editor o via CLI:
--    supabase db push  (o pegar el contenido en el editor)
--
-- 2. Verificar que no queden torneos con status='active':
--    select status, count(*) from public.tournaments group by status;
-- ============================================================
