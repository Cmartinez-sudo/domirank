-- ============================================================
-- 0046 — Fix: PF/PC duplicados en polla_standings (doubles)
-- ============================================================
-- Bug detectado: en pollas (siempre doubles 2v2), los campos points_for
-- y points_against vienen 2× el valor real.
--
-- Root cause:
--   `live-match.ts::syncMatchScores` setea match_players.score = team_total
--   para AMBOS jugadores del mismo team (denormalización per-equipo, no
--   per-jugador). Cuando 0045 calcula my_team_score como
--     (select sum(score) from match_players where team=mp.team)
--   está sumando 2 filas que ya contienen el team_total → 2 × team_total.
--
--   total_points usa pm.score directo (1 fila por user_id), así que está
--   correcto.
--
-- Fix:
--   Cambiar my_team_score / opp_team_score para que vengan de match_rounds
--   (source of truth de los puntos por mano). Esto da el team total real
--   sin duplicación, y es independiente del estado de syncMatchScores.
--
-- Side effects en otras funciones (best_partner, worst_rival, streak):
--   Esas usan my_team_score > opp_team_score para determinar wins. Con el
--   bug ambos lados estaban duplicados, así que la comparación seguía
--   correcta. Las dejamos como están — no tocamos algo que funciona.
-- ============================================================

drop function if exists public.polla_standings(uuid, int, text);

create or replace function public.polla_standings(
  p_tournament_id uuid,
  p_season int default null,
  p_day_filter text default null
)
returns table (
  user_id              uuid,
  username             text,
  display_name         text,
  avatar_url           text,
  total_points         int,
  points_for           int,
  points_against       int,
  diff                 int,
  wins                 int,
  losses               int,
  win_pct              int,
  games_played         int,
  current_streak       int,
  streak_type          text,
  best_partner_id      uuid,
  best_partner_name    text,
  best_partner_wins    int,
  best_partner_losses  int,
  worst_rival_id       uuid,
  worst_rival_name     text,
  worst_rival_wins     int,
  worst_rival_losses   int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_today_start timestamptz;
  v_today_end   timestamptz;
begin
  if p_season is null then
    select current_season into v_season
      from public.tournaments where id = p_tournament_id;
  else
    v_season := p_season;
  end if;

  if p_day_filter = 'today' then
    v_today_start := date_trunc('day', (now() at time zone 'America/Caracas'))
                       at time zone 'America/Caracas';
    v_today_end   := v_today_start + interval '1 day';
  end if;

  return query
  with player_matches as (
    -- IMPORTANTE: my_team_score y opp_team_score salen de match_rounds (source
    -- of truth), no de match_players.score (que está duplicado en doubles).
    select mp.user_id, mp.team, mp.score, mp.match_id,
           coalesce((
             select sum(points)::int
               from public.match_rounds
              where match_id = mp.match_id and team = mp.team
           ), 0) as my_team_score,
           coalesce((
             select sum(points)::int
               from public.match_rounds
              where match_id = mp.match_id and team <> mp.team
           ), 0) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status in ('confirmed', 'completed')
       and (p_day_filter is null
            or (m.finished_at >= v_today_start and m.finished_at < v_today_end))
  ),
  aggregated as (
    select pm.user_id,
           -- total_points sigue siendo pm.score directo (1 fila por user_id por
           -- match, no se duplica). En doubles esto es = team_total, en singles
           -- es el score real del jugador.
           sum(pm.score)::int as total_points,
           sum(pm.my_team_score)::int as points_for,
           sum(pm.opp_team_score)::int as points_against,
           count(*) filter (where pm.my_team_score > pm.opp_team_score)::int as wins,
           count(*) filter (where pm.my_team_score < pm.opp_team_score)::int as losses,
           count(*)::int as games_played,
           case when count(*) > 0
                then round(count(*) filter (where pm.my_team_score > pm.opp_team_score) * 100.0 / count(*))::int
                else 0 end as win_pct
      from player_matches pm
     group by pm.user_id
  )
  select tp.user_id,
         p.username::text     as username,
         p.display_name::text as display_name,
         p.avatar_url::text   as avatar_url,
         coalesce(a.total_points, 0)    as total_points,
         coalesce(a.points_for, 0)      as points_for,
         coalesce(a.points_against, 0)  as points_against,
         coalesce(a.points_for - a.points_against, 0) as diff,
         coalesce(a.wins, 0)            as wins,
         coalesce(a.losses, 0)          as losses,
         coalesce(a.win_pct, 0)         as win_pct,
         coalesce(a.games_played, 0)    as games_played,
         coalesce(streak_info.count, 0) as current_streak,
         streak_info.kind               as streak_type,
         partner_info.partner_id                                                    as best_partner_id,
         partner_info.partner_name                                                  as best_partner_name,
         coalesce(partner_info.wins_together, 0)                                    as best_partner_wins,
         coalesce(partner_info.games_together - partner_info.wins_together, 0)      as best_partner_losses,
         rival_info.rival_id                                                        as worst_rival_id,
         rival_info.rival_name                                                      as worst_rival_name,
         coalesce(rival_info.games_against - rival_info.wins_for_rival, 0)          as worst_rival_wins,
         coalesce(rival_info.wins_for_rival, 0)                                     as worst_rival_losses
    from public.tournament_players tp
    join public.profiles p on p.id = tp.user_id
    left join aggregated a on a.user_id = tp.user_id
    left join lateral (
      select * from public.polla_user_streak(tp.user_id, p_tournament_id, v_season, p_day_filter)
    ) streak_info on true
    left join lateral (
      select bp.partner_id,
             bp.games_together,
             bp.wins_together,
             p2.display_name::text as partner_name
        from public.polla_best_partner(tp.user_id, p_tournament_id, v_season) bp
        left join public.profiles p2 on p2.id = bp.partner_id
    ) partner_info on true
    left join lateral (
      select wr.rival_id,
             wr.games_against,
             wr.wins_for_rival,
             p3.display_name::text as rival_name
        from public.polla_worst_rival(tp.user_id, p_tournament_id, v_season) wr
        left join public.profiles p3 on p3.id = wr.rival_id
    ) rival_info on true
   where tp.tournament_id = p_tournament_id
   order by points_for desc, wins desc, win_pct desc, diff desc;
end;
$$;

grant execute on function public.polla_standings(uuid, int, text) to authenticated;

-- ============================================================
-- VERIFICACIÓN: en una polla existente con matches confirmed,
-- points_for ahora debería ser ~ total_points (no 2×).
--   select user_id, total_points, points_for, points_against, diff
--     from public.polla_standings('<id>'::uuid);
-- ============================================================
