-- ============================================================
-- 0077 — Club Pro: org_tournaments + pairs + rounds + matches
-- ============================================================
-- Segunda migración del feature Club Pro (Phase 1 — Schema & RLS).
--
-- Tablas nuevas:
--   • org_tournaments          — torneo Swiss de parejas por organización
--   • org_tournament_pairs     — 2 jugadores por pareja (pueden ser ghost)
--   • org_tournament_rounds    — rondas del torneo (pending/in_progress/finished)
--   • org_tournament_matches   — mesa-pair vs mesa-pair dentro de una ronda
--
-- Constraint clave: solo UN torneo 'in_progress' por organización (MVP).
-- Implementado como UNIQUE INDEX PARCIAL sobre org_tournaments(organization_id)
-- WHERE status = 'in_progress'. Intento de insertar segundo in_progress
-- viola el índice.
--
-- Separación deliberada vs tablas existentes:
--   • public.tournaments        — sistema de pollas/torneos individuales existente
--   • public.tournament_players — sistema individual existente
--   • public.match_rounds       — manos de partidas 1v1/2v2 existentes
-- NO SE MEZCLAN. Coexisten en el mismo schema sin FKs cruzadas.
--
-- Dependencias: 0076 (organizations). No modifica tablas existentes.
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
-- ============================================================

-- ─── ORG_TOURNAMENTS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tournaments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name                    text NOT NULL,
  description             text,
  format                  text NOT NULL CHECK (format IN ('swiss_pairs')) DEFAULT 'swiss_pairs',
  rounds_count            int NOT NULL CHECK (rounds_count BETWEEN 2 AND 12),
  round_duration_minutes  int NOT NULL CHECK (round_duration_minutes BETWEEN 5 AND 180),
  tiebreaker              text NOT NULL DEFAULT 'margin_of_victory'
                            CHECK (tiebreaker IN ('margin_of_victory', 'buchholz', 'head_to_head')),
  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'registration', 'ready', 'in_progress', 'finished', 'cancelled')),
  current_round_number    int DEFAULT 0 NOT NULL,
  -- display_slug: identificador único para la URL pública de TV/display.
  -- Formato sugerido: {org-slug}-{torneo-nombre}-{yyyymm}
  display_slug            text UNIQUE NOT NULL,
  prize_description       text,
  scheduled_start_at      timestamptz,
  started_at              timestamptz,
  finished_at             timestamptz,
  created_at              timestamptz DEFAULT now() NOT NULL
);

-- Búsqueda por org + status (panel admin).
CREATE INDEX IF NOT EXISTS idx_org_tournaments_org_status
  ON public.org_tournaments(organization_id, status);

-- Búsqueda por display_slug (public display URL, sin auth).
CREATE INDEX IF NOT EXISTS idx_org_tournaments_display_slug
  ON public.org_tournaments(display_slug);

-- Constraint: máximo UN torneo 'in_progress' por organización.
-- Índice UNIQUE PARCIAL — se viola si se intenta insertar un segundo
-- torneo con status='in_progress' para la misma organización.
-- El intento de UPDATE de status→'in_progress' también lo activa.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_tournament_per_org
  ON public.org_tournaments(organization_id)
  WHERE status = 'in_progress';

-- ─── ORG_TOURNAMENT_PAIRS ─────────────────────────────────────
-- Una "pareja" es la unidad competitiva del torneo.
-- player_a_user_id y player_b_user_id son FK opcionales — NULL si es ghost.
-- player_a_email y player_b_email son obligatorios y únicos por torneo.

CREATE TABLE IF NOT EXISTS public.org_tournament_pairs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid REFERENCES public.org_tournaments(id) ON DELETE CASCADE NOT NULL,
  player_a_name    text NOT NULL,
  player_a_email   text NOT NULL,
  -- NULL si el jugador no tiene cuenta activa (ghost user o no registrado).
  player_a_user_id uuid REFERENCES auth.users(id),
  player_b_name    text NOT NULL,
  player_b_email   text NOT NULL,
  player_b_user_id uuid REFERENCES auth.users(id),
  initial_seed     int,
  -- Retirada: si withdrawn_at IS NOT NULL, la pareja no participa en rondas futuras.
  withdrawn_at     timestamptz,
  withdrawn_reason text,
  created_at       timestamptz DEFAULT now() NOT NULL,
  -- Un email no puede aparecer dos veces en el mismo torneo.
  UNIQUE (tournament_id, player_a_email),
  UNIQUE (tournament_id, player_b_email)
);

CREATE INDEX IF NOT EXISTS idx_org_pairs_tournament
  ON public.org_tournament_pairs(tournament_id);

-- Para lookup de "torneos en que participa este user".
CREATE INDEX IF NOT EXISTS idx_org_pairs_player_a_user
  ON public.org_tournament_pairs(player_a_user_id)
  WHERE player_a_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_pairs_player_b_user
  ON public.org_tournament_pairs(player_b_user_id)
  WHERE player_b_user_id IS NOT NULL;

-- ─── ORG_TOURNAMENT_ROUNDS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_tournament_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.org_tournaments(id) ON DELETE CASCADE NOT NULL,
  round_number  int NOT NULL CHECK (round_number >= 1),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'finished')),
  started_at    timestamptz,
  ended_at      timestamptz,
  UNIQUE (tournament_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_org_rounds_tournament
  ON public.org_tournament_rounds(tournament_id, round_number);

-- ─── ORG_TOURNAMENT_MATCHES ───────────────────────────────────
-- Cada match es una "mesa": pair_home vs pair_away.
-- pair_away_id NULL → es un "bye" (la pareja home recibe bye-win).

CREATE TABLE IF NOT EXISTS public.org_tournament_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid REFERENCES public.org_tournaments(id) NOT NULL,
  round_id        uuid REFERENCES public.org_tournament_rounds(id) ON DELETE CASCADE NOT NULL,
  table_number    int NOT NULL CHECK (table_number >= 1),
  pair_home_id    uuid REFERENCES public.org_tournament_pairs(id) NOT NULL,
  -- NULL significa bye (par impar de parejas).
  pair_away_id    uuid REFERENCES public.org_tournament_pairs(id),
  pair_home_score int CHECK (pair_home_score >= 0),
  pair_away_score int CHECK (pair_away_score >= 0),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'finished', 'bye')),
  finished_at     timestamptz,
  UNIQUE (round_id, table_number)
);

-- Búsqueda de todos los matches de una ronda (standings, display screen).
CREATE INDEX IF NOT EXISTS idx_org_matches_round
  ON public.org_tournament_matches(round_id);

-- Búsqueda de historial de matches de una pareja (standings, avoidance de rematches).
CREATE INDEX IF NOT EXISTS idx_org_matches_pair_home
  ON public.org_tournament_matches(pair_home_id);

CREATE INDEX IF NOT EXISTS idx_org_matches_pair_away
  ON public.org_tournament_matches(pair_away_id)
  WHERE pair_away_id IS NOT NULL;

-- ─── RLS: org_tournaments ─────────────────────────────────────

ALTER TABLE public.org_tournaments ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   • Miembros de la org ven TODOS los estados (draft, registration, ...).
--   • Cualquiera (incluso anon) puede ver torneos 'in_progress' o 'finished'
--     para el display screen público.
--   Nota: las dos condiciones son OR, sin USING(true).
--   La condición de status es explícita y limitada — no expone drafts.
DROP POLICY IF EXISTS org_tournaments_select ON public.org_tournaments;
CREATE POLICY org_tournaments_select ON public.org_tournaments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_tournaments.organization_id
        AND om.user_id = auth.uid()
    )
    OR status IN ('in_progress', 'finished')
  );

-- INSERT: solo owner o admin de la organización puede crear torneos.
DROP POLICY IF EXISTS org_tournaments_insert_admin ON public.org_tournaments;
CREATE POLICY org_tournaments_insert_admin ON public.org_tournaments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_tournaments.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: solo owner o admin de la organización.
DROP POLICY IF EXISTS org_tournaments_update_admin ON public.org_tournaments;
CREATE POLICY org_tournaments_update_admin ON public.org_tournaments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_tournaments.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- DELETE: solo owner. Cascada elimina pairs/rounds/matches/invitations.
DROP POLICY IF EXISTS org_tournaments_delete_owner ON public.org_tournaments;
CREATE POLICY org_tournaments_delete_owner ON public.org_tournaments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_tournaments.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- ─── RLS: org_tournament_pairs ────────────────────────────────

ALTER TABLE public.org_tournament_pairs ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   • Miembros de la org ven todas las parejas.
--   • El propio jugador (si tiene user_id) ve su pareja.
--   • Torneos públicos (in_progress/finished) → las parejas son visibles.
DROP POLICY IF EXISTS org_pairs_select ON public.org_tournament_pairs;
CREATE POLICY org_pairs_select ON public.org_tournament_pairs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_pairs.tournament_id
        AND om.user_id = auth.uid()
    )
    OR player_a_user_id = auth.uid()
    OR player_b_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_tournaments t
      WHERE t.id = org_tournament_pairs.tournament_id
        AND t.status IN ('in_progress', 'finished')
    )
  );

-- INSERT: solo admins de la org.
DROP POLICY IF EXISTS org_pairs_insert_admin ON public.org_tournament_pairs;
CREATE POLICY org_pairs_insert_admin ON public.org_tournament_pairs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_pairs.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: solo admins (ej. marcar withdrawn_at, actualizar user_id cuando claimea).
DROP POLICY IF EXISTS org_pairs_update_admin ON public.org_tournament_pairs;
CREATE POLICY org_pairs_update_admin ON public.org_tournament_pairs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_pairs.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ─── RLS: org_tournament_rounds ───────────────────────────────

ALTER TABLE public.org_tournament_rounds ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros de la org + tourneos públicos.
DROP POLICY IF EXISTS org_rounds_select ON public.org_tournament_rounds;
CREATE POLICY org_rounds_select ON public.org_tournament_rounds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_rounds.tournament_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.org_tournaments t
      WHERE t.id = org_tournament_rounds.tournament_id
        AND t.status IN ('in_progress', 'finished')
    )
  );

-- INSERT/UPDATE: solo admins (el engine en Fase 2 crea rondas).
DROP POLICY IF EXISTS org_rounds_write_admin ON public.org_tournament_rounds;
CREATE POLICY org_rounds_write_admin ON public.org_tournament_rounds
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_rounds.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_rounds.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ─── RLS: org_tournament_matches ──────────────────────────────

ALTER TABLE public.org_tournament_matches ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros de la org + torneos públicos + el propio jugador participante.
DROP POLICY IF EXISTS org_matches_select ON public.org_tournament_matches;
CREATE POLICY org_matches_select ON public.org_tournament_matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_matches.tournament_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.org_tournaments t
      WHERE t.id = org_tournament_matches.tournament_id
        AND t.status IN ('in_progress', 'finished')
    )
    -- El player también puede ver sus propios matches.
    OR EXISTS (
      SELECT 1 FROM public.org_tournament_pairs p
      WHERE p.id IN (org_tournament_matches.pair_home_id, org_tournament_matches.pair_away_id)
        AND (p.player_a_user_id = auth.uid() OR p.player_b_user_id = auth.uid())
    )
  );

-- INSERT: solo admins (el engine Swiss inserta matches al generar ronda).
DROP POLICY IF EXISTS org_matches_insert_admin ON public.org_tournament_matches;
CREATE POLICY org_matches_insert_admin ON public.org_tournament_matches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_matches.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: SOLO admins/owners pueden modificar scores y cerrar matches.
-- Players NO pueden editar scores (spec: "solo Isabel/admin").
-- Defense-in-depth: verificación doble de role.
DROP POLICY IF EXISTS org_matches_update_admin ON public.org_tournament_matches;
CREATE POLICY org_matches_update_admin ON public.org_tournament_matches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_matches.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_tournaments t
      JOIN public.organization_members om ON om.organization_id = t.organization_id
      WHERE t.id = org_tournament_matches.tournament_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ─── GRANTS ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_tournament_pairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_tournament_rounds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_tournament_matches TO authenticated;

-- Anon necesita SELECT en torneos públicos (display screen sin auth).
GRANT SELECT ON public.org_tournaments TO anon;
GRANT SELECT ON public.org_tournament_pairs TO anon;
GRANT SELECT ON public.org_tournament_rounds TO anon;
GRANT SELECT ON public.org_tournament_matches TO anon;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Tablas con RLS habilitada:
--      SELECT relname, relrowsecurity FROM pg_class
--       WHERE relname IN (
--         'org_tournaments','org_tournament_pairs',
--         'org_tournament_rounds','org_tournament_matches'
--       ) AND relkind = 'r';
--    Esperado: relrowsecurity = true en las 4.
--
-- 2. Constraint one_active_tournament_per_org:
--    a) INSERT two org_tournaments with status='in_progress' for same org → second fails.
--    b) UPDATE primer torneo a 'finished' → permite INSERT del segundo.
--
-- 3. Unique email per tournament:
--    INSERT pair with player_a_email que ya existe en ese tournament → falla.
--
-- 4. User no-miembro no ve draft:
--    Como user B, SELECT FROM org_tournaments WHERE status='draft' → 0 filas.
--
-- 5. User no-miembro SÍ ve in_progress:
--    Como user B (anon incluido), SELECT FROM org_tournaments
--    WHERE status='in_progress' → devuelve filas (public display).
--
-- 6. User no-miembro NO puede UPDATE scores:
--    Como user B, UPDATE org_tournament_matches SET pair_home_score=100 → falla RLS.
-- ============================================================
