-- ============================================================
-- 0042 — inscription_mode='polla' como first-class
-- ============================================================
-- Refactor: 'polla' pasa a ser un valor explícito del enum
-- inscription_mode, en lugar de hacer override en UI con format='polla'.
-- Permite branching por inscription_mode en ManagePageClient.
--
-- Backfill primero, constraint después: si hay pollas existentes con
-- inscription_mode='pre_formed', el ADD CONSTRAINT cross-field las
-- rechazaría. El UPDATE las corrige antes del constraint.
-- ============================================================

-- 1. Backfill: pollas con inscription_mode='pre_formed' -> 'polla'
update public.tournaments
   set inscription_mode = 'polla'
 where format = 'polla' and inscription_mode <> 'polla';

-- 2. Drop old constraint y crear nuevo con 'polla' incluido
alter table public.tournaments
  drop constraint if exists tournaments_inscription_mode_check;

alter table public.tournaments
  add constraint tournaments_inscription_mode_check
  check (inscription_mode in ('pre_formed', 'individual_manual', 'polla'));

-- 3. Cross-field constraint: polla format iff polla inscription_mode
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
