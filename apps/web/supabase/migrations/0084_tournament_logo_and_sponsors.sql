-- ============================================================
-- 0084 — Tournament logo + 2 sponsor logos
-- ============================================================
-- Adds per-tournament branding distinct from the organization's logo.
-- An org may keep its branding constant while specific tournaments
-- highlight different sponsors.
--
-- All three columns are nullable text — uploads land in the
-- `tournament-assets` Storage bucket (created out-of-band by Carlos
-- via the Supabase dashboard) and we store the public URL.
--
-- The public display view is recompiled to expose the new fields so
-- the TV screen can render them.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW.
-- ============================================================

ALTER TABLE public.org_tournaments
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS sponsor_1_logo_url text,
  ADD COLUMN IF NOT EXISTS sponsor_2_logo_url text;

COMMENT ON COLUMN public.org_tournaments.logo_url IS
  'Per-tournament logo. Falls back to organization.logo_url in UI if NULL.';

COMMENT ON COLUMN public.org_tournaments.sponsor_1_logo_url IS
  'Sponsor 1 logo (visual only — not clickable). NULL if no sponsor.';

COMMENT ON COLUMN public.org_tournaments.sponsor_2_logo_url IS
  'Sponsor 2 logo. NULL if not used.';

-- ─── Recompile tournament_public_display ──────────────────────────────

DROP VIEW IF EXISTS public.tournament_public_display;

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
  t.logo_url             AS tournament_logo_url,
  t.sponsor_1_logo_url,
  t.sponsor_2_logo_url,
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
-- 1. Columnas nuevas:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name='org_tournaments'
--         AND column_name IN ('logo_url', 'sponsor_1_logo_url', 'sponsor_2_logo_url');
--    Esperado: 3 filas.
--
-- 2. Vista recompilada:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name='tournament_public_display'
--         AND column_name IN ('tournament_logo_url', 'sponsor_1_logo_url', 'sponsor_2_logo_url');
--    Esperado: 3 filas.
--
-- 3. security_invoker preservado:
--      SELECT reloptions FROM pg_class WHERE relname='tournament_public_display';
--    Esperado: contiene 'security_invoker=on'.
-- ============================================================
