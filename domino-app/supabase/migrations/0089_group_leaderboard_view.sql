-- ============================================================
-- 0089 — Grupos: group_leaderboard view
-- ============================================================
-- Vista agregada de stats por (group_id, user_id). Calcula a partir de
-- partidas atribuidas confirmadas:
--   • wins / losses (vía match_players.rank — rank=1 ≡ ganador)
--   • matches_played
--   • win_rate
--   • points_for (suma del score propio)
--   • points_against (suma del score del equipo rival en cada match)
--   • diff = pf - pa
--   • rank dentro del grupo (RANK() OVER por wins DESC, diff DESC)
--
-- ADAPTACIÓN DE LA SPEC:
-- La spec original unnest'eaba arrays `team_a_user_ids` / `team_b_user_ids`.
-- La realidad de DomiRank tiene `match_players` normalizada — esta vista
-- hace JOIN en vez de unnest. Patrón idéntico al de `tournament_player_stats`
-- (mig 0002): LATERAL que computa opp_score = sum filtered by team != mine.
--
-- SEMÁNTICA DE "amistosa":
-- La spec asumía `partidas.is_friendly`. En DomiRank se reusa `matches.rated`
-- con semántica inversa: rated=false ≡ amistosa. El filtrado por
-- `allow_friendlies` del grupo NO se aplica acá — eso es decisión del
-- attribution engine (Phase 3): si una partida no debe contar para el grupo,
-- no se inserta en group_match_attributions desde el vamos. La vista solo
-- agrega lo que ya está atribuido.
--
-- SECURITY INVOKER (no DEFINER): cada usuario ve solo las filas de los
-- grupos donde es member, vía las RLS de group_match_attributions.
-- ============================================================

CREATE OR REPLACE VIEW public.group_leaderboard AS
WITH group_match_players AS (
  -- Una row por (group_id, match_id, user_id). Filtra solo partidas
  -- confirmadas — el attestation flow garantiza que solo esos cuentan.
  SELECT
    gma.group_id,
    m.id            AS match_id,
    mp.user_id,
    mp.team,
    mp.score        AS player_score,
    mp.rank         AS player_rank
  FROM public.group_match_attributions gma
  JOIN public.matches m ON m.id = gma.match_id
  JOIN public.match_players mp ON mp.match_id = m.id
  WHERE m.status = 'confirmed'
),
per_match_player AS (
  -- Resuelve el score del equipo rival para cada (match, user) row.
  -- Equivalente al pattern de tournament_player_stats (mig 0002).
  SELECT
    gmp.group_id,
    gmp.user_id,
    gmp.player_score,
    gmp.player_rank,
    COALESCE(opp.opp_score, 0) AS opp_score
  FROM group_match_players gmp
  JOIN LATERAL (
    SELECT SUM(mp2.score) AS opp_score
      FROM public.match_players mp2
     WHERE mp2.match_id = gmp.match_id
       AND mp2.team <> gmp.team
  ) opp ON true
),
user_stats AS (
  SELECT
    group_id,
    user_id,
    COUNT(*)                                       AS matches_played,
    SUM(CASE WHEN player_rank = 1 THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN player_rank <> 1 THEN 1 ELSE 0 END) AS losses,
    SUM(player_score)                              AS points_for,
    SUM(opp_score)                                 AS points_against
  FROM per_match_player
  GROUP BY group_id, user_id
)
SELECT
  us.group_id,
  us.user_id,
  us.matches_played,
  us.wins,
  us.losses,
  CASE
    WHEN us.matches_played > 0
    THEN ROUND((us.wins::numeric * 100 / us.matches_played), 1)
    ELSE 0
  END AS win_rate,
  us.points_for,
  us.points_against,
  (us.points_for - us.points_against) AS diff,
  RANK() OVER (
    PARTITION BY us.group_id
    ORDER BY us.wins DESC, (us.points_for - us.points_against) DESC
  ) AS rank
FROM user_stats us;

-- security_invoker = on: las RLS de group_match_attributions / matches /
-- match_players se aplican al caller, no al owner del view.
ALTER VIEW public.group_leaderboard SET (security_invoker = on);

GRANT SELECT ON public.group_leaderboard TO authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. View existe con security_invoker:
--      SELECT viewname, viewowner FROM pg_views
--       WHERE viewname = 'group_leaderboard';
--      SELECT reloptions FROM pg_class
--       WHERE relname = 'group_leaderboard';
--    Esperado: reloptions contiene security_invoker=on.
--
-- 2. Grupo sin partidas: SELECT * FROM group_leaderboard WHERE group_id=G
--    → 0 rows.
--
-- 3. Atribuir partida confirmada con 4 players: la vista debe devolver
--    4 rows con matches_played=1 y wins/losses según rank.
--
-- 4. Non-member NO ve filas de grupos ajenos (vía RLS de la
--    tabla subyacente group_match_attributions).
-- ============================================================
