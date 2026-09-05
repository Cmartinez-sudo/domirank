-- ============================================================
-- 0087 — Grupos: group_match_attributions
-- ============================================================
-- Tabla puente que vincula matches (partidas) a grupos. Una partida
-- puede atribuirse a MÚLTIPLES grupos (decisión 1 del spec): si los
-- 4 jugadores son miembros activos de N grupos, la partida cuenta en
-- los N.
--
-- Nombre: la spec usaba `group_partida_attributions` — adaptado a
-- `group_match_attributions` para coincidir con la tabla real
-- (`public.matches`, no `partidas`).
--
-- INSERT bloqueado por default: el attribution engine (Phase 3) usa
-- SECURITY DEFINER vía trigger AFTER UPDATE en matches. No hay policy
-- de INSERT — el cliente no puede atribuir manualmente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_match_attributions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  match_id          uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  -- 'automatic'   : trigger AFTER UPDATE en matches confirma (Phase 3)
  -- 'retroactive' : opt-in batch al crear grupo nuevo (Phase 3, decisión 3)
  -- 'manual'      : admin atribuye explícitamente (Phase 3)
  attribution_type  text NOT NULL CHECK (attribution_type IN ('automatic', 'retroactive', 'manual')),
  attributed_at     timestamptz NOT NULL DEFAULT now(),
  -- Una misma partida puede estar en N grupos, pero solo una vez por grupo.
  UNIQUE (group_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_attributions_group
  ON public.group_match_attributions(group_id);

CREATE INDEX IF NOT EXISTS idx_attributions_match
  ON public.group_match_attributions(match_id);

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.group_match_attributions ENABLE ROW LEVEL SECURITY;

-- SELECT: solo members activos del grupo ven las atribuciones (privacidad
-- del historial del grupo).
DROP POLICY IF EXISTS attributions_select_member ON public.group_match_attributions;
CREATE POLICY attributions_select_member ON public.group_match_attributions
  FOR SELECT
  USING (public.is_group_member(auth.uid(), group_id));

-- NO POLICY de INSERT/UPDATE/DELETE: el engine usa SECURITY DEFINER
-- bypaseando RLS. Cliente directo queda bloqueado por default.

-- Grant SELECT solamente — el cliente nunca debería intentar mutar.
GRANT SELECT ON public.group_match_attributions TO authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Tabla con RLS:
--      SELECT relrowsecurity FROM pg_class
--       WHERE relname = 'group_match_attributions';
--    Esperado: true.
--
-- 2. Solo policy de SELECT:
--      SELECT polname, polcmd FROM pg_policy
--       WHERE polrelid = 'public.group_match_attributions'::regclass;
--    Esperado: 1 row con polcmd = 'r' (SELECT).
--
-- 3. Como member del grupo G: SELECT cuenta filas con group_id=G.
--    Como non-member: 0 rows.
--
-- 4. INSERT directo desde authenticated falla:
--      INSERT INTO group_match_attributions (group_id, match_id, attribution_type)
--      VALUES (...) → "new row violates row-level security policy".
-- ============================================================
