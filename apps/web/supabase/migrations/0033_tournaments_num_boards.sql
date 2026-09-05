-- ============================================================
-- 0033 — Agregar tournaments.num_boards
-- ============================================================
-- Permite configurar cuántas mesas físicas hay disponibles en
-- un torneo. El algoritmo de pairings asigna board 1..num_boards
-- en round-robin; si hay más partidas que mesas, las restantes
-- reciben board > num_boards (se juegan cuando queda una mesa libre).
--
-- Default: 1 (retro-compatible — torneos legacy no se ven afectados).
-- CHECK: entre 1 y 16 mesas.
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

alter table public.tournaments
  add column if not exists num_boards int not null default 1;

-- Constraint razonable
alter table public.tournaments
  drop constraint if exists tournaments_num_boards_check;

alter table public.tournaments
  add constraint tournaments_num_boards_check
  check (num_boards between 1 and 16);

-- ============================================================
-- Verificación post-migración:
--
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_name = 'tournaments' and table_schema = 'public'
--      and column_name = 'num_boards';
-- ============================================================
