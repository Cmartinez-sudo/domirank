-- ============================================================
-- 0076 — Club Pro: organizations + organization_members
-- ============================================================
-- Primera migración del feature Club Pro (Phase 1 — Schema & RLS).
--
-- Introduce el concepto de "organizacion" (ej. Invedin) que puede
-- gestionar torneos Swiss de parejas. Completamente separado del
-- sistema de torneos individuales existente (public.tournaments).
--
-- Tablas nuevas:
--   • organizations       — entidad organización con branding
--   • organization_members — roles: owner | admin | staff
--
-- RLS: habilitada desde la creación. Ningún USING(true).
--   - organizations: solo miembros ven su org; cualquier auth puede crear.
--   - organization_members: inserción controlada por owners/admins.
--
-- Dependencias: 0001 (profiles, auth.users). No modifica tablas existentes.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
-- ============================================================

-- ─── ORGANIZATIONS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  -- slug URL-safe: solo minúsculas, dígitos y guiones.
  slug                text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  description         text,
  logo_url            text,
  brand_primary_color text,
  contact_email       text NOT NULL,
  website_url         text,
  -- FK a auth.users (no profiles) porque el owner puede no haber hecho onboarding completo.
  created_by_user_id  uuid REFERENCES auth.users(id) NOT NULL,
  created_at          timestamptz DEFAULT now() NOT NULL
);

-- Búsqueda rápida por slug (público display URL lo usará).
CREATE INDEX IF NOT EXISTS idx_orgs_slug
  ON public.organizations(slug);

-- ─── ORGANIZATION_MEMBERS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  role            text CHECK (role IN ('owner', 'admin', 'staff')) NOT NULL,
  joined_at       timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organization_id, user_id)
);

-- Búsqueda de todas las orgs a las que pertenece un user (dashboard).
CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.organization_members(user_id);

-- Búsqueda de todos los miembros de una org.
CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON public.organization_members(organization_id);

-- ─── RLS: organizations ───────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: solo miembros de la organización.
-- Lógica: JOIN a organization_members para verificar pertenencia.
DROP POLICY IF EXISTS orgs_select_member ON public.organizations;
CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

-- INSERT: cualquier usuario autenticado puede crear una organización.
-- El created_by_user_id debe ser el caller (anti-spoof).
DROP POLICY IF EXISTS orgs_insert_authenticated ON public.organizations;
CREATE POLICY orgs_insert_authenticated ON public.organizations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_user_id = auth.uid()
  );

-- UPDATE: solo owner o admin de esa organización.
DROP POLICY IF EXISTS orgs_update_owner_admin ON public.organizations;
CREATE POLICY orgs_update_owner_admin ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- DELETE: solo owner. Cascada eliminará todo lo relacionado.
DROP POLICY IF EXISTS orgs_delete_owner ON public.organizations;
CREATE POLICY orgs_delete_owner ON public.organizations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- ─── RLS: organization_members ────────────────────────────────

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: el propio user ve sus membresías; los admins/owners ven los de su org.
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role IN ('owner', 'admin')
    )
  );

-- INSERT: solo owner o admin puede agregar miembros.
DROP POLICY IF EXISTS org_members_insert_owner_admin ON public.organization_members;
CREATE POLICY org_members_insert_owner_admin ON public.organization_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: owner/admin puede cambiar roles.
-- Restricción adicional: un owner no puede degradarse a sí mismo
-- (eso lo manejará la aplicación; RLS solo valida que el actor sea owner/admin).
DROP POLICY IF EXISTS org_members_update_owner_admin ON public.organization_members;
CREATE POLICY org_members_update_owner_admin ON public.organization_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- DELETE: owner/admin puede remover miembros.
DROP POLICY IF EXISTS org_members_delete_owner_admin ON public.organization_members;
CREATE POLICY org_members_delete_owner_admin ON public.organization_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ─── GRANTS ───────────────────────────────────────────────────
-- Necesario para que el cliente Supabase (anon/authenticated) pueda
-- acceder a las tablas (RLS controla qué filas; GRANT controla si pueden intentarlo).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Tablas existen con RLS:
--      SELECT relname, relrowsecurity FROM pg_class
--       WHERE relname IN ('organizations','organization_members')
--         AND relkind = 'r';
--    Esperado: relrowsecurity = true en ambas.
--
-- 2. Policies en organizations (4):
--      SELECT polname FROM pg_policy
--       WHERE polrelid = 'public.organizations'::regclass;
--    Esperado: orgs_select_member, orgs_insert_authenticated,
--              orgs_update_owner_admin, orgs_delete_owner.
--
-- 3. Policies en organization_members (4):
--      SELECT polname FROM pg_policy
--       WHERE polrelid = 'public.organization_members'::regclass;
--    Esperado: org_members_select, org_members_insert_owner_admin,
--              org_members_update_owner_admin, org_members_delete_owner_admin.
--
-- 4. Test de aislamiento (correr como user A):
--    a) INSERT INTO organizations (name, slug, contact_email, created_by_user_id)
--       VALUES ('Test Org', 'test-org', 'a@test.com', auth.uid())
--       → éxito.
--    b) INSERT INTO organization_members (organization_id, user_id, role)
--       VALUES (<org_id>, auth.uid(), 'owner')
--       → éxito (el caller se agrega como owner).
--    c) Como user B (diferente sesión):
--       SELECT * FROM organizations → 0 filas (no es miembro).
--    d) Como user B:
--       INSERT INTO organization_members (organization_id, user_id, role)
--       VALUES (<org_id_de_A>, auth.uid(), 'owner')
--       → falla: "new row violates row-level security policy".
-- ============================================================
