-- ============================================================
-- 0036 — Apretar tournaments.max_players check (SECURITY_AUDIT M5)
-- ============================================================
-- Migration 0032 dejó el check en (2, 256). El Zod schema del wizard
-- valida (4, 64) y bergerSchedule() ahora hace throw arriba de 64.
-- Esto deja el DB como la capa más laxa — un bypass del schema (e.g.,
-- update directo desde otro cliente RLS) podría insertar 256 y volar
-- el round-robin O(n²).
--
-- Fix: bajar el upper bound a 64. Sigue NULL-tolerant para torneos
-- legacy creados antes de EPIC R.
-- ============================================================

alter table public.tournaments
  drop constraint if exists tournaments_max_players_check;

alter table public.tournaments
  add constraint tournaments_max_players_check
  check (max_players is null or max_players between 2 and 64);

-- ============================================================
-- Verificación post-migración:
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname = 'tournaments_max_players_check';
--   -- debe terminar en "between 2 and 64"
--
-- Si alguna fila legacy ya tiene max_players > 64, el ADD CONSTRAINT
-- va a fallar. En ese caso, ejecutar antes:
--   update public.tournaments set max_players = 64 where max_players > 64;
-- ============================================================
