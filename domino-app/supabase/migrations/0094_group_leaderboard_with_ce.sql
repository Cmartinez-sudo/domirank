-- ============================================================
-- 0094 — group_leaderboard con Coeficiente de Eficiencia (CE)
-- ============================================================
-- Fase C+D — Fase 4 (UI views, leaderboard del grupo).
--
-- Reemplaza la view de mig 0089 con la fórmula CE del spec de
-- Club Pro (compute-standings.ts) para alinear el ranking con
-- las federaciones de dominó (VE/Caribe).
--
-- Fórmula CE (por partida finished, NO bye):
--   ceDelta = 1 - (loserScore / target_points)
--   winner: CE += ceDelta
--   loser:  CE -= ceDelta
--
-- target_points puede variar por partida (cada match guarda su
-- target_points propio según modality/custom_goal). El cálculo
-- es relativo a la propia partida, no a un valor global.
--
-- Sort federado: V DESC → CE DESC → puntos_a_favor DESC.
--
-- Display-only (no afecta sort): effectiveness_percent =
--   points_for / (points_for + points_against) × 100.
--
-- SECURITY INVOKER (como 0089): RLS de las tablas subyacentes
-- aplica al caller.
-- ============================================================

drop view if exists public.group_leaderboard cascade;

create or replace view public.group_leaderboard as
with group_match_players as (
  -- Una fila por (group_id, match_id, user_id) para matches confirmed.
  select
    gma.group_id,
    m.id              as match_id,
    m.target_points,
    mp.user_id,
    mp.team,
    mp.score          as player_score,
    mp.rank           as player_rank
  from public.group_match_attributions gma
  join public.matches m on m.id = gma.match_id
  join public.match_players mp on mp.match_id = m.id
  where m.status = 'confirmed'
),
per_match_player as (
  -- Resuelve opp_score, team_score (suma del equipo propio) y team_max
  -- (score del equipo ganador) para calcular CE por partida.
  select
    gmp.group_id,
    gmp.match_id,
    gmp.target_points,
    gmp.user_id,
    gmp.player_rank,
    gmp.player_score,
    -- Score del equipo PROPIO del jugador (en doubles, igual al del partner).
    coalesce(my.my_team_score, gmp.player_score) as team_score,
    coalesce(opp.opp_score, 0)                    as opp_score
  from group_match_players gmp
  left join lateral (
    select sum(mp2.score) as my_team_score
      from public.match_players mp2
     where mp2.match_id = gmp.match_id
       and mp2.team = gmp.team
  ) my on true
  left join lateral (
    select sum(mp2.score) as opp_score
      from public.match_players mp2
     where mp2.match_id = gmp.match_id
       and mp2.team <> gmp.team
  ) opp on true
),
per_player_match_ce as (
  -- CE delta por partida. Player es winner si rank=1 (mismo criterio que
  -- la view vieja). El loserScore es el opp_score si ganamos, o el team_score
  -- si perdimos. target_points es el de la partida específica.
  select
    pmp.group_id,
    pmp.user_id,
    pmp.player_rank,
    pmp.team_score,
    pmp.opp_score,
    pmp.target_points,
    case
      when pmp.player_rank = 1 then
        1.0 - (pmp.opp_score::numeric / nullif(pmp.target_points, 0))
      else
        -(1.0 - (pmp.team_score::numeric / nullif(pmp.target_points, 0)))
    end as ce_delta
  from per_match_player pmp
),
user_stats as (
  select
    group_id,
    user_id,
    count(*)                                       as matches_played,
    sum(case when player_rank = 1 then 1 else 0 end) as wins,
    sum(case when player_rank <> 1 then 1 else 0 end) as losses,
    coalesce(sum(ce_delta), 0)::numeric(10,4)       as effectiveness_coefficient,
    sum(team_score)                                 as points_for,
    sum(opp_score)                                  as points_against
  from per_player_match_ce
  group by group_id, user_id
)
select
  us.group_id,
  us.user_id,
  us.matches_played,
  us.wins,
  us.losses,
  case
    when us.matches_played > 0
    then round((us.wins::numeric * 100 / us.matches_played), 1)
    else 0
  end                                                  as win_rate,
  us.effectiveness_coefficient,
  case
    when (us.points_for + us.points_against) > 0
    then round(us.points_for::numeric * 100 / (us.points_for + us.points_against), 1)
    else 0
  end                                                  as effectiveness_percent,
  us.points_for,
  us.points_against,
  (us.points_for - us.points_against)                  as diff,
  rank() over (
    partition by us.group_id
    order by us.wins desc,
             us.effectiveness_coefficient desc,
             us.points_for desc
  ) as rank
from user_stats us;

alter view public.group_leaderboard set (security_invoker = on);

grant select on public.group_leaderboard to authenticated;

comment on view public.group_leaderboard is
  'Leaderboard agregado por (group_id, user_id) con Coeficiente de Eficiencia (CE) federado. Sort: V→CE→PF. Fase C+D #4.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. View existe con security_invoker:
--      SELECT reloptions FROM pg_class WHERE relname = 'group_leaderboard';
--    Esperado: contiene security_invoker=on.
--
-- 2. Columnas nuevas:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='group_leaderboard'
--         AND column_name IN ('effectiveness_coefficient','effectiveness_percent');
--    Esperado: 2 filas.
--
-- 3. Smoke test del CE:
--    - Grupo G, target_points=100.
--    - Partida 1: winner team_score=100, loser team_score=30. CE winner = +0.70, loser = -0.70.
--    - Partida 2: winner team_score=100, loser team_score=95. CE winner = +0.05, loser = -0.05.
--    - SELECT effectiveness_coefficient FROM group_leaderboard WHERE group_id=G AND user_id=winner;
--    - Esperado: 0.75 (suma de +0.70 + +0.05 para el winner si jugó ambas).
-- ============================================================
