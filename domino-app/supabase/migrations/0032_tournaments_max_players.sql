-- ============================================================
-- 0032 — Agregar tournaments.max_players (gap del EPIC R)
-- ============================================================
-- El wizard R2 setea max_players en cada creación, y el manage / pair
-- assignment lo leen. La columna nunca había sido agregada por una
-- migración anterior, así que el INSERT desde el wizard fallaba con
-- "Could not find the 'max_players' column".
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

alter table public.tournaments
  add column if not exists max_players int;

-- Constraint razonable: si está, debe ser positivo. NULL queda permitido
-- para torneos creados antes del EPIC R (legacy).
alter table public.tournaments
  drop constraint if exists tournaments_max_players_check;

alter table public.tournaments
  add constraint tournaments_max_players_check
  check (max_players is null or max_players between 2 and 256);

-- ============================================================
-- Verificación post-migración:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'tournaments' and table_schema = 'public'
--      and column_name = 'max_players';
-- ============================================================
