-- ============================================================
-- 0088 — Grupos: group_invitations (audit log)
-- ============================================================
-- Log permanente de invitaciones. Sirve para:
--   • Audit trail (quién invitó a quién y cuándo)
--   • Reenvío de emails (Phase 6)
--   • UI "Invitaciones pendientes" en /invitations (Phase 2)
--   • Expiración automática (expires_at + cron)
--
-- Nota: el "estado de membership" vive en group_members (status='invited'
-- → 'active'). Esta tabla es complementaria — guarda la historia del
-- evento de invitación específico (con el log, una re-invitación crea
-- una nueva row aquí pero solo flippea group_members.status).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_invitations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  invited_user_id      uuid REFERENCES auth.users(id) NOT NULL,
  invited_by_user_id   uuid REFERENCES auth.users(id) NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  notification_sent_at timestamptz,
  responded_at         timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- "Invitaciones pendientes para mí" — la query principal del UI /invitations.
CREATE INDEX IF NOT EXISTS idx_invitations_user_pending
  ON public.group_invitations(invited_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_group
  ON public.group_invitations(group_id);

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: el invitee ve sus propias invitations; los admins del grupo
-- ven todas las invitations del grupo (para gestionar reenvíos).
DROP POLICY IF EXISTS invitations_select_involved ON public.group_invitations;
CREATE POLICY invitations_select_involved ON public.group_invitations
  FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR public.is_group_admin(auth.uid(), group_id)
  );

-- INSERT: solo admins del grupo invitan.
DROP POLICY IF EXISTS invitations_insert_admin ON public.group_invitations;
CREATE POLICY invitations_insert_admin ON public.group_invitations
  FOR INSERT
  WITH CHECK (
    public.is_group_admin(auth.uid(), group_id)
    AND invited_by_user_id = auth.uid()
  );

-- UPDATE: el invitee responde (accept/reject) tocando su propia row.
-- Los admins NO modifican el log — si quieren re-invitar, insertan otra row.
DROP POLICY IF EXISTS invitations_update_invited_user ON public.group_invitations;
CREATE POLICY invitations_update_invited_user ON public.group_invitations
  FOR UPDATE
  USING (invited_user_id = auth.uid());

-- ─── GRANTS ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.group_invitations TO authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. RLS habilitada:
--      SELECT relrowsecurity FROM pg_class
--       WHERE relname = 'group_invitations';
--    Esperado: true.
--
-- 2. 3 policies (select/insert/update):
--      SELECT polname, polcmd FROM pg_policy
--       WHERE polrelid = 'public.group_invitations'::regclass;
--
-- 3. Como admin de grupo G: ve todas las invitations de G.
--    Como invitee: ve solo las suyas (de cualquier grupo).
--    Como otro user: 0 rows.
-- ============================================================
