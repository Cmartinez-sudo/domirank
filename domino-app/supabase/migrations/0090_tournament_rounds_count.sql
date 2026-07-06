-- ============================================================
-- 0090 — tournaments.rounds_count
-- ============================================================
-- Refactor Fase B: configs Club Pro al wizard regular.
-- Agrega rounds_count a la tabla `tournaments` (la del wizard regular).
-- Solo aplica a formato Suizo — los demás formatos ignoran el valor
-- (Round Robin deriva n-1, Single Elim deriva log2(n), continuous_league
-- es open-ended).
--
-- NULLABLE intencional: torneos existentes (Suizo o no) quedan en NULL.
-- El motor de pairings ya tiene comportamiento default para Suizo cuando
-- no hay rounds_count seteado, así que no se requiere backfill.
--
-- Rango 2..12 alineado con org_tournaments.rounds_count (mig 0077).
-- ============================================================

alter table public.tournaments
  add column if not exists rounds_count int
    check (rounds_count is null or rounds_count between 2 and 12);

comment on column public.tournaments.rounds_count is
  'Cantidad de rondas a jugar (solo aplica a format=swiss). NULL = motor decide.';
