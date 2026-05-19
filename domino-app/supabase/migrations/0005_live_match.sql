-- ============================================================
-- DomiRank · migración 0005
-- Soporte para partida en vivo: tabla de manos (rounds), estados
-- in_progress / completed, y un único "live match" activo por usuario.
-- ============================================================

-- La columna `status` ya existe en matches (de 0001) con valores
-- ('completed','in_progress','cancelled'). Solo aseguramos defaults útiles.

alter table public.matches
  alter column status set default 'in_progress';

-- Permitir que las columnas snapshot mu_after / sigma_after sean nulas
-- mientras la partida está in_progress; se llenan al finalizar.
-- (En esquema 0001 ya eran nullable.)

-- ============================================================
-- MATCH_ROUNDS: cada "mano" jugada durante una partida en vivo.
-- Una mano agrega puntos al equipo activo. Tipo:
--   - 'points'   : suma normal de puntos (típica)
--   - 'capicua'  : suma el bonus capicúa de la modalidad
--   - 'tranque'  : suma puntos al ganador del tranque (futuro v2)
-- ============================================================
create table if not exists public.match_rounds (
  id            bigserial primary key,
  match_id      uuid not null references public.matches(id) on delete cascade,
  round_number  integer not null,
  team          integer not null check (team between 1 and 8),
  points        integer not null check (points >= 0),
  kind          text not null default 'points' check (kind in ('points','capicua','tranque')),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,

  unique (match_id, round_number)
);

create index if not exists match_rounds_match_idx on public.match_rounds (match_id, round_number);

-- ============================================================
-- Vista helper: score actual y total de manos por partida
-- ============================================================
create or replace view public.match_live_state as
select
  m.id as match_id,
  m.status,
  m.target_points,
  coalesce(sum(mr.points) filter (where mr.team = 1), 0) as score_team_1,
  coalesce(sum(mr.points) filter (where mr.team = 2), 0) as score_team_2,
  count(mr.id)::int as rounds_played
from public.matches m
left join public.match_rounds mr on mr.match_id = m.id
group by m.id;

grant select on public.match_live_state to authenticated;

-- ============================================================
-- RLS para match_rounds
-- ============================================================
alter table public.match_rounds enable row level security;

drop policy if exists match_rounds_read_all on public.match_rounds;
drop policy if exists match_rounds_insert_creator on public.match_rounds;
drop policy if exists match_rounds_delete_creator on public.match_rounds;

create policy match_rounds_read_all on public.match_rounds for select using (true);
create policy match_rounds_insert_creator on public.match_rounds for insert with check (
  exists (select 1 from public.matches m where m.id = match_id and m.created_by = auth.uid() and m.status = 'in_progress')
);
create policy match_rounds_delete_creator on public.match_rounds for delete using (
  exists (select 1 from public.matches m where m.id = match_id and m.created_by = auth.uid() and m.status = 'in_progress')
);

-- ============================================================
-- Helper: solo puede haber UNA partida in_progress por usuario.
-- ============================================================
create unique index if not exists matches_one_inprogress_per_user
  on public.matches (created_by)
  where status = 'in_progress';
