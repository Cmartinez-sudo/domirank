-- ============================================================
-- 0099 — Permitir format='round_robin_individual' en tournaments
-- ============================================================
-- El CHECK constraint tournaments_format_check tenía una lista fija
-- de formatos válidos que no incluye 'round_robin_individual'. Este
-- formato es necesario para el sprint de Round Robin Individual
-- (sistema regular, PR #60).
--
-- Cambio:
--   DROP + ADD del CHECK constraint incluyendo el nuevo valor.
--
-- Impacto:
--   Ninguno en filas existentes (todas ya cumplen el nuevo CHECK).
--   Idempotente: usa DROP IF EXISTS.
-- ============================================================

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_format_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_format_check
  CHECK (format IN (
    'single_elim',
    'round_robin',
    'round_robin_individual',
    'swiss',
    'continuous_league',
    'rotation',
    'double_elim',
    'points_league'
  ));

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. INSERT con format='round_robin_individual' debe funcionar:
--    INSERT INTO tournaments (name, format, ...) VALUES ('test', 'round_robin_individual', ...);
--
-- 2. INSERT con format inválido sigue fallando:
--    INSERT INTO tournaments (name, format, ...) VALUES ('test', 'nonexistent', ...);
--    → error "violates check constraint tournaments_format_check"
-- ============================================================
