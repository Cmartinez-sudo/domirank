-- ============================================================
-- 0081 — Club Pro: scoring de dominó federado
-- ============================================================
-- Primera migración de Fase 2 (Swiss engine v2).
--
-- Cambios:
--   1. ADD `target_points` (meta de tantos por partida: 100/200/300/350...).
--      El reglamento federado define la meta UNA vez por torneo.
--   2. DROP `tiebreaker` (enum margin_of_victory/buchholz/head_to_head).
--      En dominó federado el orden de desempate es FIJO por reglamento
--      (FMD, USA Domino Federation, FIDO): wins → CE → tantos → head-to-head.
--      No es configurable por torneo — eliminarlo evita inconsistencias.
--   3. RECOMPILE vista `tournament_public_display` para:
--        a) Incluir target_points (la pantalla TV lo necesita: "Mesa 1: 87/200").
--        b) Quitar tiebreaker (columna dropeada).
--      Mantiene security_invoker = on (consistente con mig 0075/0080).
--
-- Sin riesgo de data loss: org_tournaments está vacía en prod (Fase 1
-- recién mergeada, ningún torneo creado todavía).
--
-- Dependencias: 0077 (org_tournaments), 0080 (vista).
-- Idempotente: ADD COLUMN IF NOT EXISTS, DROP COLUMN IF EXISTS, CREATE OR REPLACE VIEW.
-- ============================================================

ALTER TABLE public.org_tournaments
  ADD COLUMN IF NOT EXISTS target_points int NOT NULL DEFAULT 200
    CHECK (target_points BETWEEN 50 AND 500);

COMMENT ON COLUMN public.org_tournaments.target_points IS
  'Meta de tantos por partida. El ganador llega a este valor o el reloj se agota. Sin "excedido" — el engine capea pointsScored a este valor para cómputo de CE y standings.';

-- Drop dependent view first — tournament_public_display selects tiebreaker.
-- We recreate it below with target_points and without tiebreaker.
DROP VIEW IF EXISTS public.tournament_public_display;

ALTER TABLE public.org_tournaments
  DROP COLUMN IF EXISTS tiebreaker;

-- ============================================================
-- Recompilar vista pública: drop tiebreaker, add target_points.
-- ============================================================

CREATE VIEW public.tournament_public_display AS
SELECT
  t.id,
  t.name,
  t.display_slug,
  t.status,
  t.current_round_number,
  t.rounds_count,
  t.round_duration_minutes,
  t.target_points,
  t.started_at,
  t.finished_at,
  o.name            AS organization_name,
  o.slug            AS organization_slug,
  o.logo_url        AS organization_logo_url,
  o.brand_primary_color
FROM public.org_tournaments t
JOIN public.organizations o ON o.id = t.organization_id
WHERE t.status IN ('in_progress', 'finished');

ALTER VIEW public.tournament_public_display SET (security_invoker = on);

GRANT SELECT ON public.tournament_public_display TO anon, authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Columna nueva:
--      SELECT column_name, data_type, column_default
--        FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='org_tournaments'
--         AND column_name='target_points';
--    Esperado: 1 fila, int, default 200.
--
-- 2. Columna eliminada:
--      SELECT 1 FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='org_tournaments'
--         AND column_name='tiebreaker';
--    Esperado: 0 filas.
--
-- 3. Vista incluye target_points:
--      SELECT * FROM tournament_public_display LIMIT 0;
--    Las columnas devueltas incluyen target_points y NO tiebreaker.
--
-- 4. Vista sigue security_invoker:
--      SELECT reloptions FROM pg_class WHERE relname='tournament_public_display';
--    Esperado: contiene 'security_invoker=on'.
--
-- 5. Linter Supabase: 0 nuevos errors.
-- ============================================================
