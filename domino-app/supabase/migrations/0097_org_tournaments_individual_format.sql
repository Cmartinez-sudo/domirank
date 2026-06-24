-- ============================================================
-- 0097 — Club Pro: añadir formato Individual (1v1)
-- ============================================================
-- Permite que org_tournaments soporte format='swiss_individual'
-- además del actual 'swiss_pairs'. Reutiliza la tabla
-- org_tournament_pairs: cuando format='swiss_individual',
-- player_b_name y player_b_email quedan NULL y el "pair"
-- representa a un solo jugador.
--
-- El motor Swiss no cambia — opera sobre pair_id (UUID).
-- La fórmula CE no cambia — ±(1 − P_perdedor / P_meta).
--
-- Cambios:
--   1. ALTER org_tournament_pairs: player_b_name/email DROP NOT NULL.
--   2. CHECK pair_consistency: ambos NULL o ambos NOT NULL.
--   3. DROP+ADD format_check: acepta 'swiss_pairs' o 'swiss_individual'.
--   4. Trigger enforce_pair_consistency_with_format:
--      bloquea pair con player_b en tournament individual y
--      pair sin player_b en tournament pairs.
--   5. Trigger format_immutable: bloquea UPDATE de format.
--   6. View tournament_public_display: expone 'format' para que
--      el display público pueda renderizar UI condicional.
--
-- Backward compat: torneos existentes con format='swiss_pairs'
-- siguen funcionando sin cambios. UNIQUE (tournament_id, player_b_email)
-- permite múltiples NULLs (semántica Postgres por default).
-- ============================================================

-- ─── 1. NULLABILIDAD player_b ─────────────────────────────────

ALTER TABLE public.org_tournament_pairs
  ALTER COLUMN player_b_name  DROP NOT NULL,
  ALTER COLUMN player_b_email DROP NOT NULL;

-- ─── 2. Consistencia interna del pair ─────────────────────────
-- Ambos NULL (individual) o ambos NOT NULL (pair). Prohibido mix.

ALTER TABLE public.org_tournament_pairs
  DROP CONSTRAINT IF EXISTS org_tournament_pairs_pair_consistency;

ALTER TABLE public.org_tournament_pairs
  ADD CONSTRAINT org_tournament_pairs_pair_consistency CHECK (
    (player_b_name IS NULL  AND player_b_email IS NULL)
    OR
    (player_b_name IS NOT NULL AND player_b_email IS NOT NULL)
  );

-- ─── 3. Format check actualizado ──────────────────────────────

ALTER TABLE public.org_tournaments
  DROP CONSTRAINT IF EXISTS org_tournaments_format_check;

ALTER TABLE public.org_tournaments
  ADD CONSTRAINT org_tournaments_format_check
  CHECK (format IN ('swiss_pairs', 'swiss_individual'));

-- ─── 4. Trigger: pair ↔ format consistency ────────────────────
-- Cuando se inserta/actualiza un pair, verifica que su forma
-- (con o sin player_b) coincida con el format del torneo.

CREATE OR REPLACE FUNCTION public.enforce_pair_consistency_with_format()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_format text;
BEGIN
  SELECT format INTO v_format
  FROM public.org_tournaments
  WHERE id = NEW.tournament_id;

  IF v_format IS NULL THEN
    RAISE EXCEPTION 'Tournament % does not exist', NEW.tournament_id;
  END IF;

  IF v_format = 'swiss_individual' AND NEW.player_b_name IS NOT NULL THEN
    RAISE EXCEPTION 'Tournament is individual — player_b_name must be NULL';
  END IF;

  IF v_format = 'swiss_pairs' AND NEW.player_b_name IS NULL THEN
    RAISE EXCEPTION 'Tournament is pairs — player_b_name is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pair_format_consistency
  ON public.org_tournament_pairs;

CREATE TRIGGER trg_enforce_pair_format_consistency
  BEFORE INSERT OR UPDATE ON public.org_tournament_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pair_consistency_with_format();

-- ─── 5. Trigger: format es immutable post-creación ────────────
-- Permitir cambiar format después de tener pairs/matches sería
-- catastrófico para la UI y los datos. Bloquear cualquier UPDATE
-- que toque la columna.

CREATE OR REPLACE FUNCTION public.enforce_tournament_format_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.format IS DISTINCT FROM OLD.format THEN
    RAISE EXCEPTION 'Tournament format is immutable (was %, attempted %)',
      OLD.format, NEW.format;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tournament_format_immutable
  ON public.org_tournaments;

CREATE TRIGGER trg_enforce_tournament_format_immutable
  BEFORE UPDATE OF format ON public.org_tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tournament_format_immutable();

-- ─── 6. View pública: exponer format ──────────────────────────
-- El display público necesita saber el format para condicionar
-- labels ("JUGADOR" vs "PAREJA") y nombres ("Pedro" vs "Pedro & X").

CREATE OR REPLACE VIEW public.tournament_public_display AS
SELECT
  t.id,
  t.name,
  t.display_slug,
  t.status,
  t.format,
  t.current_round_number,
  t.rounds_count,
  t.round_duration_minutes,
  t.tiebreaker,
  t.started_at,
  t.finished_at,
  o.name            AS organization_name,
  o.slug            AS organization_slug,
  o.logo_url        AS organization_logo_url,
  o.brand_primary_color
FROM public.org_tournaments t
JOIN public.organizations o ON o.id = t.organization_id
WHERE t.status IN ('in_progress', 'finished');

ALTER VIEW public.tournament_public_display SET (security_invoker = on);

GRANT SELECT ON public.tournament_public_display TO anon, authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. NOT NULL drop:
--    \d public.org_tournament_pairs
--    Esperado: player_b_name y player_b_email sin "not null".
--
-- 2. Format check acepta ambos:
--    INSERT org_tournaments con format='swiss_individual' → OK.
--
-- 3. Trigger pair consistency:
--    a) format='swiss_pairs', INSERT pair con player_b NULL → falla.
--    b) format='swiss_individual', INSERT pair con player_b NOT NULL → falla.
--    c) Casos válidos → OK.
--
-- 4. Trigger format immutable:
--    UPDATE org_tournaments SET format='swiss_pairs' WHERE format='swiss_individual'
--    → falla con "Tournament format is immutable".
--
-- 5. View expone format:
--    SELECT format FROM tournament_public_display WHERE display_slug='...';
-- ============================================================
