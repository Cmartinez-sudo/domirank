-- ============================================================
-- 0086 — Grupos: groups + group_members + permission helpers
-- ============================================================
-- Primera migración de la feature "Grupos" (CLAUDE_CODE_GRUPOS_ARCHITECTURE.md).
-- Un "grupo" es una colección persistente de jugadores que comparten
-- historial de partidas (absorbe la feature legacy "Polla"/continuous_league).
--
-- Phase 1 alcance (este commit + los siguientes 0087-0089):
--   • Schemas: groups, group_members, group_match_attributions, group_invitations
--   • Helpers: is_group_member(), is_group_admin()
--   • RLS habilitada con policies por tabla
--   • View: group_leaderboard (security_invoker)
--
-- Adaptaciones de la spec original al schema real de DomiRank:
--   • La spec habla de `partidas` — la tabla real es `public.matches` (0001).
--   • La spec habla de `is_friendly` en partidas — la tabla real expone
--     `matches.rated` (semántica inversa: rated=false ≡ amistosa/casual).
--   • La spec asume `team_a_user_ids uuid[]` — la realidad es
--     `match_players(match_id, user_id, team, score)` normalizada (0001).
--   • FK de migración referencia `tournaments(id)` (filtrar por
--     `format='continuous_league'` en código, no en constraint).
--
-- Patrón anti-recursión: las policies usan helpers SECURITY DEFINER
-- (is_group_member/is_group_admin) en vez de EXISTS sobre la misma
-- tabla — la lección de mig 0083 (organization_members recursion bug).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE FUNCTION.
-- ============================================================

-- ─── GROUPS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description                 text CHECK (description IS NULL OR char_length(description) <= 500),
  created_by_user_id          uuid REFERENCES auth.users(id) NOT NULL,
  -- Si false, las partidas con matches.rated=false NO se atribuyen
  -- al grupo (decisión 4: amistosas cuentan por default, opt-out por grupo).
  allow_friendlies            boolean NOT NULL DEFAULT true,
  -- Soft-delete: la UI nunca hard-deletea; flippea is_active.
  is_active                   boolean NOT NULL DEFAULT true,
  -- Trazabilidad de migración Polla → Grupo (Phase 5). Referencia
  -- tournaments(id) en general; el código filtra format='continuous_league'.
  migrated_from_tournament_id uuid REFERENCES public.tournaments(id),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by
  ON public.groups(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_groups_migrated
  ON public.groups(migrated_from_tournament_id)
  WHERE migrated_from_tournament_id IS NOT NULL;

-- ─── GROUP_MEMBERS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id             uuid REFERENCES auth.users(id) NOT NULL,
  role                text NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'co_admin', 'member')),
  -- Decisión 6: invitee DEBE aceptar. El admin inserta con 'invited';
  -- el user transiciona a 'active' via accept_group_invitation() (Phase 2).
  status              text NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'active', 'left', 'removed')),
  invited_by_user_id  uuid REFERENCES auth.users(id),
  invited_at          timestamptz NOT NULL DEFAULT now(),
  joined_at           timestamptz,
  left_at             timestamptz,
  -- Decisión 5: anonimización opcional al hacer soft-leave.
  anonymized          boolean NOT NULL DEFAULT false,
  UNIQUE (group_id, user_id)
);

-- Lookup principal: "¿en qué grupos activos estoy?" (sidebar, attribution engine).
CREATE INDEX IF NOT EXISTS idx_group_members_user_active
  ON public.group_members(user_id)
  WHERE status = 'active';

-- Lookup secundario: "¿quiénes son los members activos de este grupo?"
CREATE INDEX IF NOT EXISTS idx_group_members_group_active
  ON public.group_members(group_id)
  WHERE status = 'active';

-- ─── PERMISSION HELPERS (SECURITY DEFINER) ────────────────────
-- Bypasean RLS para hacer los lookups internos. Sin esto, las policies
-- caerían en recursión infinita al validar EXISTS contra la misma tabla
-- (bug histórico de 0076 → 0083 en org_members_select).

CREATE OR REPLACE FUNCTION public.is_group_member(
  p_user_id uuid,
  p_group_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
     WHERE user_id = p_user_id
       AND group_id = p_group_id
       AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(
  p_user_id uuid,
  p_group_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
     WHERE user_id = p_user_id
       AND group_id = p_group_id
       AND status = 'active'
       AND role IN ('admin', 'co_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;

-- ─── RLS: groups ──────────────────────────────────────────────

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- SELECT: grupo es privado — solo members activos lo ven.
DROP POLICY IF EXISTS groups_select_member ON public.groups;
CREATE POLICY groups_select_member ON public.groups
  FOR SELECT
  USING (public.is_group_member(auth.uid(), id));

-- INSERT: cualquier user autenticado crea grupo, debe self-attribute creator.
DROP POLICY IF EXISTS groups_insert_authenticated ON public.groups;
CREATE POLICY groups_insert_authenticated ON public.groups
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by_user_id = auth.uid()
  );

-- UPDATE: admins/co_admins editan settings del grupo.
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
CREATE POLICY groups_update_admin ON public.groups
  FOR UPDATE
  USING (public.is_group_admin(auth.uid(), id));

-- DELETE: solo creator. UI nunca debería invocarlo (siempre soft delete via
-- is_active=false); el policy existe como red de seguridad.
DROP POLICY IF EXISTS groups_delete_creator ON public.groups;
CREATE POLICY groups_delete_creator ON public.groups
  FOR DELETE
  USING (created_by_user_id = auth.uid());

-- ─── RLS: group_members ───────────────────────────────────────

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- SELECT: members activos ven a todos los del mismo grupo; siempre ves
-- tus propias rows (incluso si status='invited' o 'left').
DROP POLICY IF EXISTS members_select_same_group ON public.group_members;
CREATE POLICY members_select_same_group ON public.group_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_group_member(auth.uid(), group_id)
  );

-- INSERT: admins invitan (status='invited') o el invitee acepta su propia
-- invitación. La RPC accept_group_invitation() de Phase 2 hará UPDATE,
-- no INSERT — esta policy cubre el flow de admin invitando.
DROP POLICY IF EXISTS members_insert_admin_or_self ON public.group_members;
CREATE POLICY members_insert_admin_or_self ON public.group_members
  FOR INSERT
  WITH CHECK (
    public.is_group_admin(auth.uid(), group_id)
    OR user_id = auth.uid()
  );

-- UPDATE: admins gestionan roles/status; member solo toca su propia row
-- (acepta invitación, hace soft-leave). No bloqueamos transición invalida
-- aquí — la RPC de Phase 2 valida el state machine.
DROP POLICY IF EXISTS members_update_admin_or_self ON public.group_members;
CREATE POLICY members_update_admin_or_self ON public.group_members
  FOR UPDATE
  USING (
    public.is_group_admin(auth.uid(), group_id)
    OR user_id = auth.uid()
  );

-- DELETE: no policy. Soft-delete (status='left'|'removed') siempre.

-- ─── GRANTS ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.group_members TO authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Tablas con RLS habilitada:
--      SELECT relname, relrowsecurity FROM pg_class
--       WHERE relname IN ('groups','group_members') AND relkind='r';
--    Esperado: relrowsecurity = true en ambas.
--
-- 2. Helpers existen y son SECURITY DEFINER:
--      SELECT proname, prosecdef FROM pg_proc
--       WHERE proname IN ('is_group_member','is_group_admin');
--    Esperado: prosecdef = true en ambas.
--
-- 3. Policies en groups (4):
--      SELECT polname FROM pg_policy
--       WHERE polrelid = 'public.groups'::regclass;
--    Esperado: groups_select_member, groups_insert_authenticated,
--              groups_update_admin, groups_delete_creator.
--
-- 4. Policies en group_members (3):
--      SELECT polname FROM pg_policy
--       WHERE polrelid = 'public.group_members'::regclass;
--    Esperado: members_select_same_group, members_insert_admin_or_self,
--              members_update_admin_or_self.
--
-- 5. Smoke test (como user A):
--    a) INSERT INTO groups (name, created_by_user_id)
--       VALUES ('Test', auth.uid()) → éxito.
--    b) INSERT INTO group_members (group_id, user_id, role, status)
--       VALUES (<id>, auth.uid(), 'admin', 'active') → éxito.
--    c) Como user B: SELECT * FROM groups → 0 rows (no es member).
-- ============================================================
