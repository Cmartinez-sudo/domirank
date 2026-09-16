-- ============================================================
-- 0111 — Display config (org-level) + flexible tournament sponsors
-- ============================================================
-- Foundation for the display layout editor (Phase 1). This migration
-- prepares the schema so a future admin UI can persist chrome-layout
-- decisions at the organization level, and so each tournament can
-- ship an arbitrary number of sponsor logos instead of the two fixed
-- columns we shipped in 0084.
--
-- Nothing in this migration changes what the public display renders
-- today: the app-side fallback (DEFAULT_DISPLAY_CONFIG in
-- lib/club-pro/display-config.ts) mirrors the current hardcoded layout,
-- so orgs that never touch display_config keep the same TV output.
--
-- What this migration does:
--
--   1. Adds `organizations.display_config JSONB` (nullable, no default).
--      The Zod schema + resolver live in the app; this column just
--      persists whatever the resolver validated. NULL means "use the
--      code-side default".
--
--   2. Creates `tournament_sponsors` — one row per logo, ordered by
--      `position` (1..12). Cascade-deletes with the tournament.
--
--   3. Backfills `tournament_sponsors` from the two legacy columns
--      `org_tournaments.sponsor_1_logo_url` and `sponsor_2_logo_url`,
--      then DROPS them. Clean cut — no dual-write phase.
--
--   4. Recompiles `tournament_public_display` to expose
--      `display_config` (for the display shell to consume) and drop the
--      two legacy sponsor columns (sponsors now come from the join to
--      `tournament_sponsors`).
--
-- Ordering matters:
--   - Step 3.b (DROP columns) must run AFTER 4 recompile succeeds,
--     because the CREATE OR REPLACE VIEW variant would fail if the new
--     column list didn't match. We DROP the view first, then DROP the
--     columns, then CREATE the view fresh — same pattern as mig 0084.
--
-- Idempotent where possible: CREATE TABLE IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS. The backfill INSERT is idempotent thanks to the
-- (tournament_id, position) UNIQUE constraint + ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── 1. organizations.display_config ─────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS display_config JSONB;

COMMENT ON COLUMN public.organizations.display_config IS
  'Layout config for the org''s public tournament display screen. '
  'NULL means "use the code-side default". Validated app-side with Zod '
  '(lib/club-pro/display-config.ts). Read publicly via '
  'tournament_public_display view; only owner/admin can update.';

-- ─── 2. tournament_sponsors ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournament_sponsors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid NOT NULL REFERENCES public.org_tournaments(id) ON DELETE CASCADE,
  position        int  NOT NULL CHECK (position >= 1 AND position <= 12),
  logo_url        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, position)
);

CREATE INDEX IF NOT EXISTS idx_tournament_sponsors_tournament
  ON public.tournament_sponsors(tournament_id, position);

COMMENT ON TABLE public.tournament_sponsors IS
  'Sponsor logos rendered on the public TV display. One row per logo, '
  'ordered by position (1..12). Cascade-deleted with the tournament.';

-- ─── 3.a Backfill from legacy columns ────────────────────────
-- Only runs if the legacy columns are still present. If a previous
-- environment already applied the migration + dropped the columns,
-- this INSERT is skipped by the DO block.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'org_tournaments'
       AND column_name  = 'sponsor_1_logo_url'
  ) THEN
    INSERT INTO public.tournament_sponsors (tournament_id, position, logo_url)
    SELECT id, 1, sponsor_1_logo_url
      FROM public.org_tournaments
     WHERE sponsor_1_logo_url IS NOT NULL
    ON CONFLICT (tournament_id, position) DO NOTHING;

    INSERT INTO public.tournament_sponsors (tournament_id, position, logo_url)
    SELECT id, 2, sponsor_2_logo_url
      FROM public.org_tournaments
     WHERE sponsor_2_logo_url IS NOT NULL
    ON CONFLICT (tournament_id, position) DO NOTHING;
  END IF;
END $$;

-- ─── 4. Recompile the public display view ────────────────────
-- Drop first (columns being removed), then recreate without them and
-- with the new display_config column projected.

DROP VIEW IF EXISTS public.tournament_public_display;

-- ─── 3.b Drop the legacy columns AFTER view is dropped ───────

ALTER TABLE public.org_tournaments
  DROP COLUMN IF EXISTS sponsor_1_logo_url,
  DROP COLUMN IF EXISTS sponsor_2_logo_url;

-- ─── 4 (cont.). Recreate view ───────────────────────────────

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
  o.name                 AS organization_name,
  o.slug                 AS organization_slug,
  o.logo_url             AS organization_logo_url,
  o.brand_primary_color,
  o.display_config
FROM public.org_tournaments t
JOIN public.organizations o ON o.id = t.organization_id
WHERE t.status IN ('in_progress', 'finished');

ALTER VIEW public.tournament_public_display SET (security_invoker = on);

GRANT SELECT ON public.tournament_public_display TO anon, authenticated;

-- ─── RLS: tournament_sponsors ────────────────────────────────

ALTER TABLE public.tournament_sponsors ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read sponsors of an in_progress/finished tournament
-- (the public display is anonymous). Members of the owning org can also
-- read sponsors of any of the org's tournaments regardless of status.
DROP POLICY IF EXISTS tournament_sponsors_select ON public.tournament_sponsors;
CREATE POLICY tournament_sponsors_select ON public.tournament_sponsors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      WHERE t.id = tournament_sponsors.tournament_id
        AND t.status IN ('in_progress', 'finished')
    )
    OR EXISTS (
      SELECT 1
        FROM public.org_tournaments t
        JOIN public.organization_members om
          ON om.organization_id = t.organization_id
       WHERE t.id = tournament_sponsors.tournament_id
         AND om.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: only owner or admin of the tournament's org.
DROP POLICY IF EXISTS tournament_sponsors_write_admin ON public.tournament_sponsors;
CREATE POLICY tournament_sponsors_write_admin ON public.tournament_sponsors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
        FROM public.org_tournaments t
        JOIN public.organization_members om
          ON om.organization_id = t.organization_id
       WHERE t.id = tournament_sponsors.tournament_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.org_tournaments t
        JOIN public.organization_members om
          ON om.organization_id = t.organization_id
       WHERE t.id = tournament_sponsors.tournament_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner', 'admin')
    )
  );

-- Note on organizations.display_config: no dedicated RLS added — the
-- existing organizations SELECT policy is member-only, but the display
-- reads via `tournament_public_display` (SECURITY INVOKER + anon-safe
-- because tournaments in in_progress/finished have a public RLS lane
-- and the org join reveals only the branding columns projected above).

-- ============================================================
-- VERIFICATION
-- ============================================================
-- 1. display_config column exists:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_schema = 'public'
--         AND table_name   = 'organizations'
--         AND column_name  = 'display_config';
--    Expected: 1 row.
--
-- 2. tournament_sponsors exists with constraint:
--      SELECT table_name FROM information_schema.tables
--       WHERE table_schema = 'public'
--         AND table_name = 'tournament_sponsors';
--    Expected: 1 row.
--      SELECT conname FROM pg_constraint
--       WHERE conrelid = 'public.tournament_sponsors'::regclass
--         AND contype = 'u';
--    Expected: contains a unique constraint on (tournament_id, position).
--
-- 3. Backfill applied:
--      SELECT count(*) FROM public.tournament_sponsors;
--    Expected: sum of tournaments that had sponsor_1 or sponsor_2 set.
--
-- 4. Legacy columns gone:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'org_tournaments'
--         AND column_name IN ('sponsor_1_logo_url', 'sponsor_2_logo_url');
--    Expected: 0 rows.
--
-- 5. View recompiled with new shape:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'tournament_public_display'
--         AND column_name IN ('display_config',
--                             'sponsor_1_logo_url',
--                             'sponsor_2_logo_url');
--    Expected: 1 row (display_config), and 0 rows for the sponsor_* names.
--
-- 6. View still SECURITY INVOKER:
--      SELECT reloptions FROM pg_class
--       WHERE relname = 'tournament_public_display';
--    Expected: contains 'security_invoker=on'.
--
-- 7. Public read of sponsors for a finished tournament (as anon):
--      SELECT position, logo_url
--        FROM public.tournament_sponsors
--       WHERE tournament_id = '<finished tournament uuid>'
--    ORDER BY position;
--    Expected: rows visible, ordered.
-- ============================================================
