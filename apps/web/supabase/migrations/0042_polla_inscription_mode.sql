-- ============================================================
-- 0042 — inscription_mode='polla' como first-class
-- ============================================================
-- Refactor: 'polla' pasa a ser un valor explícito del enum
-- inscription_mode, en lugar de hacer override en UI con format='polla'.
-- Permite branching por inscription_mode en ManagePageClient.
--
-- ORDEN CRÍTICO:
--   1. DROP constraint viejo (sin 'polla')
--   2. UPDATE backfill (ahora permitido — sin constraint)
--   3. ADD constraint nuevo (con 'polla')
--   4. ADD cross-field constraint
--
-- Si invertís el orden (UPDATE primero), Postgres chequea el constraint
-- viejo contra el valor nuevo y rechaza con
-- "violates check constraint tournaments_inscription_mode_check".
-- ============================================================

-- 1. Drop el constraint viejo PRIMERO para liberar el UPDATE
alter table public.tournaments
  drop constraint if exists tournaments_inscription_mode_check;

-- 2. Backfill: pollas con inscription_mode='pre_formed' -> 'polla'
update public.tournaments
   set inscription_mode = 'polla'
 where format = 'polla' and inscription_mode <> 'polla';

-- 3. Add el constraint nuevo con 'polla' incluido
alter table public.tournaments
  add constraint tournaments_inscription_mode_check
  check (inscription_mode in ('pre_formed', 'individual_manual', 'polla'));

-- 4. Cross-field constraint: polla format iff polla inscription_mode
alter table public.tournaments
  drop constraint if exists tournaments_format_inscription_check;

alter table public.tournaments
  add constraint tournaments_format_inscription_check
  check (
    (format = 'polla' and inscription_mode = 'polla')
    or (format <> 'polla' and inscription_mode <> 'polla')
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select inscription_mode, count(*) from public.tournaments
--    group by inscription_mode;
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname in (
--      'tournaments_inscription_mode_check',
--      'tournaments_format_inscription_check'
--    );
-- ============================================================
