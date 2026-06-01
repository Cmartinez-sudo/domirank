-- ============================================================
-- 0050 — Backfill: continuous_league existentes con requires_attestation=false
-- ============================================================
-- F1.7 del refactor TOURNAMENT_WIZARD_REFACTOR.md.
--
-- La mig 0049 agregó la columna requires_attestation con default true.
-- Pero las continuous_league existentes (antes pollas) tenían bypass
-- por hardcode en finalizeMatch — Carlos lo decidió porque se juegan IRL
-- con scorekeeper presencial confiable.
--
-- F1.7 generaliza el bypass: el código ahora lee requires_attestation
-- del torneo en lugar de chequear format === 'continuous_league'. Para
-- preservar el comportamiento histórico de las pollas viejas, hay que
-- backfilearlas a requires_attestation = false (el default de la
-- columna las dejó en true, que sería una regresión silenciosa).
--
-- Los continuous_league NUEVOS creados después de F1.4 con el wizard
-- nuevo escriben el valor que el organizer eligió en opciones avanzadas
-- (default true en UI). El organizer puede explícitamente pedir
-- attestation en una continuous_league si quiere — el flag es respetado.
--
-- Dependencias:
--   - mig 0047 (F1.1): enum renombrado a continuous_league
--   - mig 0048 (F1.2): RPCs renombradas
--   - mig 0049 (F1.3): columna requires_attestation creada
-- ============================================================

update public.tournaments
   set requires_attestation = false
 where format = 'continuous_league';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Todas las continuous_league existentes ahora tienen attestation OFF:
--      select count(*) as total,
--             count(*) filter (where requires_attestation = false) as bypass_count
--        from public.tournaments
--       where format = 'continuous_league';
--    Esperado: total = bypass_count.
--
-- 2. Otros formatos siguen con default true (sin afectar):
--      select format,
--             count(*) filter (where requires_attestation = true) as attest_on,
--             count(*) filter (where requires_attestation = false) as attest_off
--        from public.tournaments
--       group by format
--       order by format;
--    Esperado: solo continuous_league tiene filas con attestation OFF.
-- ============================================================
