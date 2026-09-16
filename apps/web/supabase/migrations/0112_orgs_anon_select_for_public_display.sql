-- ============================================================
-- 0112 — Public display: SELECT policy on `organizations` for anon
-- ============================================================
-- Fixes a latent bug in the public display screen (/t/[slug]).
--
-- `tournament_public_display` is a security_invoker=on view that
-- JOINs `org_tournaments` (0080) with `organizations` (branding
-- columns). Mig 0082 added an anon-friendly SELECT policy on
-- org_tournaments — but the equivalent for organizations was never
-- added. Result: as soon as the display was hit by a real
-- unauthenticated viewer (e.g. a TV browser without a session), the
-- JOIN silently dropped every row and the page returned 404 via
-- notFound(). Members loading the same URL saw the display fine
-- because the member-only policy resolved for them, which masked the
-- bug in every internal test until we deployed the editor and
-- started curling prod as anon.
--
-- Scope of the new policy is intentionally narrow: anon can read an
-- org row ONLY if that org has at least one tournament in
-- 'in_progress' or 'finished' — the same states the view already
-- filters by. Draft/registration orgs stay invisible to anon, just
-- like the tournaments themselves. Branding columns exposed by the
-- view (name, slug, logo_url, brand_primary_color, display_config)
-- are all safe to publish alongside the public display.
--
-- The existing `orgs_select_member` policy stays as-is; Postgres OR's
-- policies for the same command, so members keep seeing every org
-- they belong to regardless of tournament state.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================

DROP POLICY IF EXISTS orgs_select_public_display ON public.organizations;

CREATE POLICY orgs_select_public_display ON public.organizations
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.org_tournaments t
       WHERE t.organization_id = organizations.id
         AND t.status IN ('in_progress', 'finished')
    )
  );

COMMENT ON POLICY orgs_select_public_display ON public.organizations IS
  'Permite leer organizaciones que tienen al menos un torneo público '
  '(in_progress o finished), para que la vista tournament_public_display '
  'pueda resolver el JOIN cuando el caller es anon. Complementa '
  'org_tournaments_select_public de mig 0082.';

-- ─── GRANT SELECT to anon (was authenticated-only in mig 0076) ─
-- Necessary because policies alone don''t grant table access — anon
-- must also hold the SELECT privilege on the table itself.

GRANT SELECT ON public.organizations TO anon;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- 1. Anon can now resolve the display view for a public tournament:
--    As anon:
--      SELECT display_slug, organization_name
--        FROM public.tournament_public_display
--       WHERE display_slug = '<in_progress or finished slug>';
--    Expected: 1 row.
--
-- 2. Anon still cannot read the org table for orgs that have only
--    draft/registration tournaments:
--    As anon:
--      SELECT id FROM public.organizations
--       WHERE id = '<org whose all tournaments are draft>';
--    Expected: 0 rows.
--
-- 3. Members still see all orgs they belong to (existing policy):
--    As <member of org X>:
--      SELECT id FROM public.organizations WHERE id = 'X';
--    Expected: 1 row.
-- ============================================================
