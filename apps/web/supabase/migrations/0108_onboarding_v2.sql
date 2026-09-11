-- ============================================================
-- DomiRank · migración 0108
-- Sprint 1b: Onboarding v2 + first_valuable_action tracking + p1 dismiss.
--
-- Cambios:
--   1. profiles.onboarding_version (default 2 nuevos, 1 legacy)
--   2. profiles.onboarding_step (para reanudar el flow)
--   3. profiles.onboarding_completed_at + onboarding_skipped
--   4. profiles.p1_dismissed_count (Regla 8: contador para degradar P1)
--   5. profiles.first_valuable_action_at + first_valuable_action_via
--      (Regla 15: métrica de activación separada de completion)
--   6. Nueva tabla onboarding_progress (Regla 8: guardar respuestas
--      incrementales del skill assessment).
--   7. Backfill legacy: onboarding_version = 1 para usuarios ya onboarded.
--      Los verá el banner S5 en Sprint 1c.
-- ============================================================

-- ─── 1. profiles: columnas nuevas ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_version int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS onboarding_step text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS p1_dismissed_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_valuable_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_valuable_action_via text
    CHECK (first_valuable_action_via IS NULL OR first_valuable_action_via IN
      ('match_created_with_cojugador', 'invite_accepted', 'group_with_member'));

CREATE INDEX IF NOT EXISTS idx_profiles_first_valuable_action
  ON public.profiles(first_valuable_action_at)
  WHERE first_valuable_action_at IS NOT NULL;

-- ─── 2. onboarding_progress: respuestas incrementales ─────────

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers     jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS op_select_own ON public.onboarding_progress;
CREATE POLICY op_select_own ON public.onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS op_insert_own ON public.onboarding_progress;
CREATE POLICY op_insert_own ON public.onboarding_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS op_update_own ON public.onboarding_progress;
CREATE POLICY op_update_own ON public.onboarding_progress
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS op_delete_own ON public.onboarding_progress;
CREATE POLICY op_delete_own ON public.onboarding_progress
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;

-- ─── 3. RPC para increment atómico de p1_dismissed_count ────

CREATE OR REPLACE FUNCTION public.increment_p1_dismissed(p_user_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET p1_dismissed_count = p1_dismissed_count + 1
   WHERE id = p_user_id AND id = auth.uid()
  RETURNING p1_dismissed_count;
$$;

GRANT EXECUTE ON FUNCTION public.increment_p1_dismissed(uuid) TO authenticated;

-- ─── 4. Backfill legacy (S5) ──────────────────────────────────

UPDATE public.profiles
   SET onboarding_version = 1
 WHERE onboarded = true
   AND onboarding_version = 2  -- solo los que quedaron con el default nuevo
   AND onboarding_completed_at IS NULL;  -- y no ya migrados

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Columnas nuevas:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'profiles'
--         AND column_name IN (
--           'onboarding_version','onboarding_step','onboarding_completed_at',
--           'onboarding_skipped','p1_dismissed_count',
--           'first_valuable_action_at','first_valuable_action_via'
--         );
--
-- 2. Tabla onboarding_progress con RLS:
--      SELECT relname, relrowsecurity FROM pg_class
--       WHERE relname = 'onboarding_progress';
--
-- 3. Backfill legacy:
--      SELECT onboarding_version, count(*) FROM profiles
--       WHERE onboarded = true GROUP BY 1;
--    Esperado: la mayoría en version=1 (todos los legacy).
--
-- 4. Constraint CHECK first_valuable_action_via:
--    INSERT/UPDATE con valor inválido debe fallar.
-- ============================================================
