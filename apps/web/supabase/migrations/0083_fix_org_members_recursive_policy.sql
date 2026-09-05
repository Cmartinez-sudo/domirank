-- ============================================================
-- 0083 — Fix recursive RLS policy on organization_members
-- ============================================================
-- Bug: the SELECT policy created in 0076 referenced organization_members
-- inside its own USING clause (EXISTS against the same table to check if
-- the caller was an admin of the org). Postgres re-evaluates the policy
-- for the inner SELECT → infinite recursion → query aborts with
-- "infinite recursion detected in policy for relation".
--
--   USING (
--     user_id = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM organization_members om2  -- recursive!
--        WHERE om2.organization_id = organization_members.organization_id
--          AND om2.user_id = auth.uid()
--          AND om2.role IN ('owner', 'admin')
--     )
--   )
--
-- Impact: /admin showed "no sos miembro" for users who WERE members,
-- because the membership lookup itself failed.
--
-- Fix: drop the recursive policy and replace with the simple
-- "see your own membership" rule. The "admin can see other members of
-- their org" semantic is deferred — currently no UI surface needs it.
-- When it does, the right fix is a SECURITY DEFINER helper function
-- like `is_org_admin(org_id, user_id)` that bypasses RLS for its
-- internal SELECT.
--
-- Idempotent.
-- ============================================================

DROP POLICY IF EXISTS org_members_select ON public.organization_members;

CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON POLICY org_members_select ON public.organization_members IS
  'Each user can read their own memberships. Listing other members of an org (e.g. for an admin team management UI) is deferred to a SECURITY DEFINER helper function when needed.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. La policy ya no es recursiva:
--      SELECT polname, pg_get_expr(polqual, polrelid) AS using_clause
--        FROM pg_policy
--       WHERE polrelid = 'public.organization_members'::regclass
--         AND polname = 'org_members_select';
--    Esperado: USING (user_id = auth.uid()), sin EXISTS sobre la misma tabla.
--
-- 2. Como user logueado, leer mi membership:
--      SELECT * FROM organization_members WHERE user_id = auth.uid();
--    Esperado: filas del user. SIN error de "infinite recursion".
-- ============================================================
