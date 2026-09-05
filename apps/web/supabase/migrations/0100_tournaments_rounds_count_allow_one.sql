-- ============================================================
-- 0100 — Relajar CHECK tournaments_rounds_count_check a 1..12
-- ============================================================
-- Antes: rounds_count IS NULL OR (rounds_count BETWEEN 2 AND 12)
-- Ahora: rounds_count IS NULL OR (rounds_count BETWEEN 1 AND 12)
--
-- Motivación:
--   El formato round_robin_individual (mig 0099) permite R = 1 (un solo
--   ciclo completo del fixture whist). Con N=5 y R=1 son 5 partidas —
--   una velada corta y honesta. El CHECK anterior forzaba R>=2, que
--   duplicaba las partidas innecesariamente.
--
--   Swiss también acepta R=1 (single-round Swiss = pareamiento aleatorio
--   inicial sin más rondas). Poco común pero no prohibido.
--
-- Cambio:
--   DROP + ADD del constraint idempotente.
--
-- Backward compat:
--   Filas existentes con rounds_count IN (2..12) o NULL siguen válidas.
--   Ninguna fila queda inválida por el cambio.
-- ============================================================

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_rounds_count_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_rounds_count_check
  CHECK (rounds_count IS NULL OR (rounds_count BETWEEN 1 AND 12));

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Constraint activo:
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname='tournaments_rounds_count_check';
--    → 'CHECK ((rounds_count IS NULL OR ((rounds_count >= 1) AND (rounds_count <= 12))))'
--
-- 2. INSERT con rounds_count=1 debe funcionar:
--    INSERT INTO tournaments (name, ..., rounds_count) VALUES ('test', ..., 1);
--    → OK
--
-- 3. INSERT con rounds_count=0 debe fallar:
--    → violates check constraint tournaments_rounds_count_check
--
-- 4. INSERT con rounds_count=13 sigue fallando:
--    → violates check constraint tournaments_rounds_count_check
-- ============================================================
