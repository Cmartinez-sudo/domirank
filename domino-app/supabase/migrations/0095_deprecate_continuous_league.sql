-- ============================================================
-- 0095 — Deprecar formato continuous_league (Fase C+D #5)
-- ============================================================
-- Reemplazado por el sistema de Grupos (migraciones 0086-0089 y
-- Fases C+D #2-4).
--
-- Decisión (grilling 2026-06-22, Fase 5 opción ii):
-- cancelar TODOS los torneos continuous_league activos al
-- desplegar. El historial se preserva (status='cancelled', el
-- detalle sigue accesible read-only).
--
-- Soft remove: NO se borran tablas continuous_league_* ni el
-- enum value 'continuous_league' del CHECK constraint. Torneos
-- viejos siguen visibles en /tournaments y /tournaments/[id]
-- con `status='cancelled'`. La validación de status existente
-- bloquea naturalmente crear partidas nuevas en estos torneos.
-- ============================================================

update public.tournaments
   set status = 'cancelled'
 where format = 'continuous_league'
   and status in ('open', 'in_progress', 'draft');

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. No quedan torneos continuous_league activos:
--      select count(*) from public.tournaments
--       where format = 'continuous_league'
--         and status in ('open', 'in_progress', 'draft');
--    Esperado: 0.
--
-- 2. Cuántos torneos quedaron cancelled como resultado:
--      select count(*) from public.tournaments
--       where format = 'continuous_league' and status = 'cancelled';
--    (Snapshot informativo, sin valor esperado.)
-- ============================================================
