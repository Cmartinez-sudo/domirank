-- ============================================================
-- 0101 — get_tournament_standings: agregar CE (Coeficiente Eficiencia)
-- ============================================================
-- Extiende la RPC para incluir CE (federated) y global_display + is_rated
-- del profile_ratings para el rediseño del leaderboard estilo Grupos.
--
-- CE se calcula igual que en group_leaderboard (mig 0094):
--   Por partida:
--     Si ganó:   +(1 − loser_score / target_points)
--     Si perdió: −(1 − team_score / target_points)
--   CE total = sum(ce_delta) por user en el torneo.
--
-- Solo confirmed matches. rank=1 → winner.
--
-- Backward compat: la firma cambia (agrega 2 columnas). Callers viejos
-- que hacen SELECT * seguirán funcionando pero recibirán 2 columnas
-- extra. El TypeScript client se actualiza en el mismo PR.
-- ============================================================

drop function if exists public.get_tournament_standings(uuid);

create or replace function public.get_tournament_standings(p_tournament_id uuid)
returns table (
  rank                       bigint,
  user_id                    uuid,
  username                   text,
  display_name               text,
  avatar_url                 text,
  wins                       bigint,
  losses                     bigint,
  win_pct                    numeric,
  effectiveness_coefficient  numeric,
  pf                         bigint,
  pc                         bigint,
  plus_minus                 bigint,
  streak                     text,
  last5                      text[],
  prev_rank                  int,
  global_display             numeric,
  is_rated                   boolean
)
language sql stable security definer set search_path = public
as $$
with
players as (
  select tp.user_id, p.username::text, p.display_name, p.avatar_url
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = p_tournament_id
),
-- Un row por (match, user_id) con team_score, opp_score, target_points.
per_match_player as (
  select
    m.id                                                       as match_id,
    m.target_points,
    mp.user_id,
    mp.team,
    mp.rank                                                    as player_rank,
    mp.score                                                   as player_score,
    coalesce(my.my_team_total, mp.score)                       as team_score,
    coalesce(opp.opp_total, 0)                                 as opp_score
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  left join lateral (
    select sum(mp2.score) as my_team_total
    from public.match_players mp2
    where mp2.match_id = m.id and mp2.team = mp.team
  ) my on true
  left join lateral (
    select sum(mp2.score) as opp_total
    from public.match_players mp2
    where mp2.match_id = m.id and mp2.team <> mp.team
  ) opp on true
  where m.tournament_id = p_tournament_id
    and m.status = 'confirmed'
),
-- CE delta por (match, user).
per_player_ce as (
  select
    pmp.user_id,
    pmp.player_rank,
    pmp.team_score,
    pmp.opp_score,
    pmp.target_points,
    case
      when pmp.player_rank = 1
        then 1.0 - (pmp.opp_score::numeric / nullif(pmp.target_points, 0))
      else
        -(1.0 - (pmp.team_score::numeric / nullif(pmp.target_points, 0)))
    end as ce_delta
  from per_match_player pmp
),
stats as (
  select
    ppc.user_id,
    count(*)                                                              as games,
    sum(case when ppc.player_rank = 1 then 1 else 0 end)                  as wins,
    sum(case when ppc.player_rank <> 1 then 1 else 0 end)                 as losses,
    sum(ppc.team_score)                                                   as points_for,
    sum(ppc.opp_score)                                                    as points_against,
    coalesce(sum(ppc.ce_delta), 0)::numeric(10,4)                          as effectiveness_coefficient
  from per_player_ce ppc
  group by ppc.user_id
),
ranked as (
  select
    pl.user_id,
    pl.username,
    pl.display_name,
    pl.avatar_url,
    coalesce(s.games, 0)                                                  as games,
    coalesce(s.wins, 0)                                                   as wins,
    coalesce(s.losses, 0)                                                 as losses,
    coalesce(s.points_for, 0)                                             as points_for,
    coalesce(s.points_against, 0)                                         as points_against,
    coalesce(s.effectiveness_coefficient, 0)                              as effectiveness_coefficient,
    case when coalesce(s.games,0) = 0 then 0::numeric
         else round(s.wins::numeric / s.games * 100, 1)
    end as win_pct,
    row_number() over (
      order by
        coalesce(s.wins, 0)                                              desc,
        coalesce(s.effectiveness_coefficient, 0)                          desc,
        coalesce(s.points_for,0) - coalesce(s.points_against,0)          desc,
        coalesce(s.points_for, 0)                                         desc
    ) as rank
  from players pl
  left join stats s on s.user_id = pl.user_id
),
recent_matches as (
  select
    mp.user_id,
    case when mp.rank = 1 then 'W' else 'L' end as result,
    m.confirmed_at,
    row_number() over (
      partition by mp.user_id
      order by m.confirmed_at desc nulls last, m.finished_at desc nulls last
    ) as rn
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  where m.tournament_id = p_tournament_id
    and m.status = 'confirmed'
),
last5_agg as (
  select
    user_id,
    array_agg(result order by rn desc) filter (where rn <= 5) as last5_newest_first
  from recent_matches
  group by user_id
),
streak_raw as (
  select
    user_id,
    result as streak_result,
    count(*) as streak_len
  from (
    select
      user_id,
      result,
      rn,
      row_number() over (partition by user_id order by rn)
      - row_number() over (partition by user_id, result order by rn) as grp
    from recent_matches
    where rn <= 20
  ) x
  where grp = (
    select min(grp2) from (
      select
        user_id as u2,
        row_number() over (partition by user_id order by rn)
        - row_number() over (partition by user_id, result order by rn) as grp2
      from recent_matches rm2
      where rm2.user_id = x.user_id and rm2.rn <= 20
    ) sub
    where u2 = x.user_id
  )
  group by user_id, streak_result, grp
),
prev_snapshots as (
  select distinct on (user_id)
    user_id,
    rank as prev_rank
  from (
    select
      user_id,
      rank,
      snapshot_at,
      dense_rank() over (
        partition by user_id
        order by snapshot_at desc
      ) as snap_num
    from public.tournament_rank_snapshots
    where tournament_id = p_tournament_id
  ) snaps
  where snap_num = 2
  order by user_id
),
-- Global rating por user (para "Global · X" en la celda JUGADOR).
ratings as (
  select id, global_display, is_rated
  from public.profile_ratings
)
select
  r.rank,
  r.user_id,
  r.username,
  r.display_name,
  r.avatar_url,
  r.wins,
  r.losses,
  r.win_pct,
  r.effectiveness_coefficient,
  r.points_for                                         as pf,
  r.points_against                                     as pc,
  (r.points_for - r.points_against)                    as plus_minus,
  coalesce(
    (sr.streak_len::text || sr.streak_result),
    '0W'
  )                                                    as streak,
  coalesce(l5.last5_newest_first, '{}'::text[])        as last5,
  ps.prev_rank,
  rt.global_display,
  coalesce(rt.is_rated, false)                         as is_rated
from ranked r
left join streak_raw sr         on sr.user_id = r.user_id
left join last5_agg l5          on l5.user_id = r.user_id
left join prev_snapshots ps     on ps.user_id = r.user_id
left join ratings rt            on rt.id = r.user_id
order by r.rank;
$$;

grant execute on function public.get_tournament_standings(uuid) to anon, authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Firma incluye effectiveness_coefficient, global_display, is_rated:
--    \df public.get_tournament_standings
--
-- 2. Un torneo con confirmed matches devuelve CE ≠ 0 para el ganador:
--    SELECT user_id, wins, effectiveness_coefficient
--    FROM get_tournament_standings('<uuid>')
--    ORDER BY rank;
-- ============================================================
