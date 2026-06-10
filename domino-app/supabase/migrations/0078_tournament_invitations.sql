-- ============================================================
-- 0078 — Club Pro: org_tournament_invitations
-- ============================================================
-- Tercera migración del feature Club Pro (Phase 1 — Schema & RLS).
--
-- Tabla nueva:
--   • org_tournament_invitations — audit log de invitaciones por email.
--     Cada invitación lleva un claim_token único que sirve para que
--     un ghost user active su cuenta desde el link del email.
--
-- Esta tabla es el registro de "qué emails fueron invitados, cuándo,
-- y si ya activaron su cuenta". Separada de profiles para preservar
-- audit trail incluso si el ghost user después se elimina.
--
-- RLS:
--   • Admins de la org ven y crean invitaciones.
--   • El propio ghost user (por ghost_user_id) puede ver su invitación.
--   • La consulta por claim_token (flow /claim/[token]) se hace
--     desde un server action con service_role — no necesita policy SELECT pública.
--
-- Dependencias: 0077 (org_tournaments, org_tournament_pairs).
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_tournament_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid REFERENCES public.org_tournaments(id) ON DELETE CASCADE NOT NULL,
  pair_id         uuid REFERENCES public.org_tournament_pairs(id) ON DELETE SET NULL,
  -- Email al que se mandó la invitación.
  email           text NOT NULL,
  player_name     text NOT NULL,
  -- Token único para el link de activación: /claim/{claim_token}.
  -- Generado con gen_random_uuid()::text o crypto.randomUUID() en la edge function.
  claim_token     text UNIQUE NOT NULL,
  -- FK al ghost user creado (o al perfil existente si el email ya tenía cuenta).
  ghost_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         timestamptz DEFAULT now() NOT NULL,
  -- Pixel tracking o click en el email.
  opened_at       timestamptz,
  -- Cuándo el usuario activó su cuenta usando este token.
  claimed_at      timestamptz
);

-- Lookup de todas las invitaciones de un torneo (tab Pairs del admin).
CREATE INDEX IF NOT EXISTS idx_org_invitations_tournament
  ON public.org_tournament_invitations(tournament_id);

-- Lookup por email (verificar si ya fue invitado antes de reenviar).
CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON public.org_tournament_invitations(email);

-- Lookup por ghost_user_id (para el claim flow).
CREATE INDEX IF NOT EXISTS idx_org_invitations_ghost_user
  ON public.org_tournament_invitations(ghost_user_id)
  WHERE ghost_user_id IS NOT NULL;

-- ─── RLS: org_tournament_invitations ─────────────────────────

ALTER TABLE public.org_tournament_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: admins de la org ven todas las invitaciones del torneo.
--         El ghost user ve solo su propia invitación (para el claim flow).
-- Nota: la consulta por claim_token desde /claim/[token] usa service_role
--       en un server action — bypassea RLS intencionalmente (claim es público).
DROP POLICY IF EXISTS org_invitations_select ON public.org_tournament_invitations;
CREATE POLICY org_invitations_select ON public.org_tournament_invitations
  FOR SELECT
  USING (
    -- Admin/owner de la org del torneo.
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_invitations.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    -- El ghost user ve su propia invitación (después de activar su cuenta).
    OR ghost_user_id = auth.uid()
  );

-- INSERT: solo admins de la org (cuando Isabel manda invitaciones).
DROP POLICY IF EXISTS org_invitations_insert_admin ON public.org_tournament_invitations;
CREATE POLICY org_invitations_insert_admin ON public.org_tournament_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_invitations.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: solo admins (ej. marcar opened_at, claimed_at).
-- El claim flow server action usa service_role para actualizar claimed_at.
DROP POLICY IF EXISTS org_invitations_update_admin ON public.org_tournament_invitations;
CREATE POLICY org_invitations_update_admin ON public.org_tournament_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_invitations.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ─── GRANTS ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.org_tournament_invitations TO authenticated;
-- Anon NO tiene acceso a invitaciones (el claim usa service_role).

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. RLS habilitada:
--      SELECT relrowsecurity FROM pg_class
--       WHERE relname = 'org_tournament_invitations';
--    Esperado: true.
--
-- 2. claim_token es UNIQUE:
--    INSERT dos invitaciones con mismo claim_token → segundo falla.
--
-- 3. Aislamiento org:
--    Como user B (no admin de org A), SELECT FROM org_tournament_invitations
--    WHERE tournament_id = <torneo de org A> → 0 filas.
--
-- 4. Ghost user ve solo la suya:
--    Como ghost_user (después de activar cuenta), SELECT → 1 fila.
--    Como ghost_user, SELECT invitación de otro ghost → 0 filas.
-- ============================================================
