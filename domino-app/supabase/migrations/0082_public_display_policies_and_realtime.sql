-- ============================================================
-- 0082 — Public display: SELECT policies for anon + Realtime publication
-- ============================================================
-- Habilita la pantalla pública /t/[slug] (Fase 4 del feature Club Pro).
--
-- Problema que resuelve:
--   Las políticas existentes en org_tournaments / pairs / rounds / matches
--   (mig 0077) solo permiten SELECT a org members. La vista
--   tournament_public_display tiene security_invoker=on (mig 0080+0081),
--   lo cual delega la decisión a las policies de las tablas subyacentes
--   — y esas bloquean a anon. Resultado: el display público devolvía 0
--   filas. Bug latente que no detectamos antes porque nunca hubo data real.
--
--   El fix es OR: además de members, anon/authenticated pueden leer si
--   el torneo es 'in_progress' o 'finished' (semántica idéntica al WHERE
--   de la vista).
--
-- Plus: Realtime publication. Para que el display reciba broadcasts de
-- cambios en vivo, las tablas deben estar en supabase_realtime. NO añadimos
-- pairs ni invitations — pairs no cambian durante el torneo (solo via
-- markPairWithdrawn que es rara), invitations son privadas.
--
-- Las tablas Realtime expuestas:
--   • org_tournaments       — para detectar transición a/desde 'in_progress'
--   • org_tournament_rounds — para detectar inicio/fin de cada ronda
--   • org_tournament_matches — para scores en vivo
--
-- Idempotente: DROP POLICY IF EXISTS + ADD TABLE IF NOT EXISTS via DO block.
-- ============================================================

-- ─── org_tournaments: SELECT público para in_progress/finished ─────────

DROP POLICY IF EXISTS org_tournaments_select_public ON public.org_tournaments;

CREATE POLICY org_tournaments_select_public ON public.org_tournaments
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('in_progress', 'finished'));

COMMENT ON POLICY org_tournaments_select_public ON public.org_tournaments IS
  'Permite leer torneos in_progress/finished a usuarios sin membership. Aplica DESPUÉS de org_tournaments_select (members), por OR-de-policies de Postgres. Hardcoded a esos dos estados para coincidir con el WHERE de tournament_public_display.';

-- ─── org_tournament_pairs ──────────────────────────────────────────────

DROP POLICY IF EXISTS org_pairs_select_public ON public.org_tournament_pairs;

CREATE POLICY org_pairs_select_public ON public.org_tournament_pairs
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
       WHERE t.id = org_tournament_pairs.tournament_id
         AND t.status IN ('in_progress', 'finished')
    )
  );

COMMENT ON POLICY org_pairs_select_public ON public.org_tournament_pairs IS
  'Permite leer parejas del torneo cuando éste es público (in_progress/finished). Necesario para que el display TV resuelva pair_home_id/pair_away_id a nombres de jugadores.';

-- ─── org_tournament_rounds ─────────────────────────────────────────────

DROP POLICY IF EXISTS org_rounds_select_public ON public.org_tournament_rounds;

CREATE POLICY org_rounds_select_public ON public.org_tournament_rounds
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
       WHERE t.id = org_tournament_rounds.tournament_id
         AND t.status IN ('in_progress', 'finished')
    )
  );

COMMENT ON POLICY org_rounds_select_public ON public.org_tournament_rounds IS
  'Permite leer rondas del torneo cuando éste es público. Necesario para el timer del display TV (started_at).';

-- ─── org_tournament_matches ────────────────────────────────────────────

DROP POLICY IF EXISTS org_matches_select_public ON public.org_tournament_matches;

CREATE POLICY org_matches_select_public ON public.org_tournament_matches
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
       WHERE t.id = org_tournament_matches.tournament_id
         AND t.status IN ('in_progress', 'finished')
    )
  );

COMMENT ON POLICY org_matches_select_public ON public.org_tournament_matches IS
  'Permite leer matches del torneo cuando éste es público. Es la tabla más viva (scores en tiempo real). Realtime también la usa abajo.';

-- ─── Realtime publication ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'org_tournaments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_tournaments;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'org_tournament_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_tournament_rounds;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'org_tournament_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_tournament_matches;
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Como anon, listar torneos públicos:
--      SELECT id, name, status FROM org_tournaments
--       WHERE status IN ('in_progress', 'finished');
--    Esperado: las filas de torneos públicos (no las drafts).
--
-- 2. Tablas en publicación realtime:
--      SELECT tablename FROM pg_publication_tables
--       WHERE pubname = 'supabase_realtime' AND schemaname='public'
--         AND tablename LIKE 'org_tournament%';
--    Esperado: 3 filas (org_tournaments, org_tournament_rounds,
--    org_tournament_matches). NOT org_tournament_pairs ni
--    org_tournament_invitations.
--
-- 3. Como anon, suscribirse a org_tournament_matches via Realtime y
--    UPDATE un match en un torneo in_progress como admin
--    → el anon recibe el broadcast.
-- ============================================================
