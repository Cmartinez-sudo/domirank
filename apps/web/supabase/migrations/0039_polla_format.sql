-- ============================================================
-- 0039 — Formato "Polla" (liga continua entre amigos)
-- ============================================================
-- Sub-story 1 del spec POLLA_FORMAT_PROMPT.md (con fixes del audit).
--
-- Decisiones de diseño:
--   - Reusa la infraestructura existente de tournaments en lugar de una
--     tabla separada `pollas`. El badge "Polla" en UI diferencia
--     conceptualmente; toda la maquinaria (tournament_players,
--     tournament_pairings, leaderboard, attestation) aplica igual.
--   - NO se agrega columna `affects_rating` separada. Se reusa la
--     columna `tournaments.rated` existente (mig 0002), ahora honored
--     por el guard agregado en applyMatchRating (PR #10).
--   - El player count constraint (4-8 par) se valida en la aplicación,
--     no en la DB — sigue el patrón del wizard.
--
-- Migración idempotente: usa `if not exists`, `drop constraint if exists`,
-- y `create or replace view`.
-- ============================================================

-- 1. Agregar 'polla' al enum de tournaments.format
alter table public.tournaments
  drop constraint if exists tournaments_format_check;

alter table public.tournaments
  add constraint tournaments_format_check
  check (format in (
    'rotation','round_robin','swiss','single_elim','double_elim','points_league',
    'polla'
  ));

-- 2. Campos nuevos en tournaments
alter table public.tournaments
  add column if not exists is_open_ended boolean not null default false;

alter table public.tournaments
  add column if not exists current_season int not null default 1;

-- 3. Season en tournament_pairings (a qué temporada del polla pertenece
--    cada pairing). Default 1 para no romper torneos preexistentes.
alter table public.tournament_pairings
  add column if not exists season int not null default 1;

create index if not exists idx_tournament_pairings_season
  on public.tournament_pairings(tournament_id, season);

-- 4. Vista helper: pairings de la temporada actual del torneo.
--    Las queries de leaderboard / partner stats filtran por esta vista
--    para que el reset de "nueva temporada" (incrementa current_season)
--    automáticamente excluya los pairings de temporadas anteriores.
create or replace view public.polla_current_season_pairings as
  select tp.*
    from public.tournament_pairings tp
    join public.tournaments t on t.id = tp.tournament_id
   where tp.season = t.current_season;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_name = 'tournaments' and table_schema = 'public'
--      and column_name in ('is_open_ended', 'current_season')
--    order by column_name;
--
--   select column_name
--     from information_schema.columns
--    where table_name = 'tournament_pairings' and column_name = 'season';
--
--   select * from public.polla_current_season_pairings limit 1;
-- ============================================================
