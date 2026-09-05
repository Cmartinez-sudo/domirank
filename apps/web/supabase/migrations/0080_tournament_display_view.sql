-- ============================================================
-- 0080 — Club Pro: vista pública tournament_public_display
-- ============================================================
-- Quinta (y última) migración del feature Club Pro (Phase 1 — Schema & RLS).
--
-- Vista nueva:
--   • tournament_public_display — datos mínimos del torneo para el
--     display screen de TV. Accesible sin auth.
--
-- Diseño de seguridad:
--   • security_invoker = on: las RLS de tablas subyacentes se evalúan
--     contra el CALLER (auth.uid() o anon), no contra el owner de la vista.
--     Esto sigue el patrón de mig 0075 (views_security_invoker).
--   • La vista hace JOIN con organizations (para branding) y filtra
--     WHERE status IN ('in_progress', 'finished') en su definición.
--   • Adicionalmente, la RLS de org_tournaments ya tiene una política
--     que permite SELECT de in_progress/finished sin auth.
--   • Combinación: RLS de tabla + filtro de vista = doble protección.
--     Nunca expone drafts aunque alguien haga SELECT directo sobre la vista.
--
-- IMPORTANTE: NO usar SECURITY DEFINER. Siempre INVOKER.
-- (Ver: spec "NO uses SECURITY DEFINER en views — siempre INVOKER")
-- (Ver: mig 0075 — hotfix que corrigió este mismo problema en las vistas viejas)
--
-- Dependencias: 0077 (org_tournaments), 0076 (organizations).
-- Idempotente: CREATE OR REPLACE VIEW.
-- ============================================================

CREATE OR REPLACE VIEW public.tournament_public_display AS
SELECT
  t.id,
  t.name,
  t.display_slug,
  t.status,
  t.current_round_number,
  t.rounds_count,
  t.round_duration_minutes,
  t.tiebreaker,
  t.started_at,
  t.finished_at,
  -- Branding de la organización (co-marca en el display screen).
  o.name            AS organization_name,
  o.slug            AS organization_slug,
  o.logo_url        AS organization_logo_url,
  o.brand_primary_color
FROM public.org_tournaments t
JOIN public.organizations o ON o.id = t.organization_id
-- Solo torneos activos o terminados — nunca drafts.
WHERE t.status IN ('in_progress', 'finished');

-- security_invoker = on: RLS de tablas subyacentes evalúada contra el caller.
-- Para anon: auth.uid() = null → las políticas de org_tournaments con la condición
-- "status IN ('in_progress','finished')" SÍ aplican para anon (no requieren auth.uid()).
ALTER VIEW public.tournament_public_display SET (security_invoker = on);

-- GRANTS: anon y authenticated pueden leer la vista.
-- La restricción real viene de: WHERE en la vista + RLS de org_tournaments.
GRANT SELECT ON public.tournament_public_display TO anon, authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Vista existe con security_invoker:
--      SELECT c.relname, c.reloptions
--        FROM pg_class c
--       WHERE c.relkind = 'v'
--         AND c.relname = 'tournament_public_display';
--    Esperado: reloptions contiene 'security_invoker=on'.
--
-- 2. Supabase linter — 0 nuevos errores:
--    a) "Security Definer View" NO debe aparecer para esta vista.
--    b) "RLS Disabled in Public" NO debe aparecer para ninguna de las
--       tablas nuevas (todas tienen RLS habilitada).
--    Correr: supabase db lint (local) o desde dashboard.
--
-- 3. Sin auth, la vista devuelve solo torneos públicos:
--    Como anon (sin token):
--      SELECT * FROM tournament_public_display;
--    Esperado: solo torneos con status IN ('in_progress','finished').
--    Los drafts NO deben aparecer nunca.
--
-- 4. Como anon, SELECT directo en org_tournaments:
--      SELECT * FROM org_tournaments WHERE status = 'draft';
--    Esperado: 0 filas (RLS bloquea drafts para no-miembros).
--
-- 5. Como admin de org, SELECT en tournament_public_display:
--    Esperado: solo torneos in_progress/finished de su org aparecen
--    (el WHERE de la vista filtra los drafts).
--    Para ver drafts, el admin debe consultar org_tournaments directamente.
--
-- 6. Integridad de join: display_slug → tournament_public_display lookup:
--      SELECT * FROM tournament_public_display
--       WHERE display_slug = 'invedin-torneo-solidario-2026';
--    Esperado: 1 fila con branding de la org.
-- ============================================================
