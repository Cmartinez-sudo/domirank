-- ============================================================
-- 0044 — Fix: polla_standings citext mismatch
-- ============================================================
-- Bug detectado en producción tras aplicar 0043:
--   ERROR: structure of query does not match function result type
--   DETAIL: Returned type citext does not match expected type text in column 2.
--
-- `profiles.username` es `citext` (case-insensitive text). Postgres no
-- castea automáticamente citext → text en el return type de una función.
-- Fix: cast explícito a ::text. Aplicamos a username (column 2) y, por
-- defensa, también a display_name/avatar_url/partner_name/rival_name por
-- si alguna columna de profiles cambia a citext en el futuro.
--
-- Idempotente: drop + recreate.
-- ============================================================

drop function if exists public.polla_standings(uuid, int);

create or replace function public.polla_standings(
  p_tournament_id uuid,
  p_season int default null
)
returns table (
  user_id              uuid,
  username             text,
  display_name         text,
  avatar_url           text,
  total_points         int,
  wins                 int,
  losses               int,
  win_pct              int,
  games_played         int,
  current_streak       text,
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
begin
  if p_season is null then
    select current_season into v_season
      from public.tournaments where id = p_tournament_id;
  else
    v_season := p_season;
  end if;

  return query
  with player_matches as (
    select mp.user_id, mp.team, mp.score, mp.match_id,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status = 'confirmed'
  ),
  aggregated as (
    select pm.user_id,
           sum(pm.score)::int as total_points,
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
         coalesce(a.total_points, 0)  as total_points,
         coalesce(a.wins, 0)          as wins,
         coalesce(a.losses, 0)        as losses,
         coalesce(a.win_pct, 0)       as win_pct,
         coalesce(a.games_played, 0)  as games_played,
         public.calc_streak(tp.user_id, p_tournament_id, v_season) as current_streak,
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
   order by total_points desc, wins desc;
end;
$$;

grant execute on function public.polla_standings(uuid, int) to authenticated;

-- ============================================================
-- VERIFICACIÓN: debería retornar N filas (N = miembros del roster) con 0s
-- en stats si la polla no tiene matches confirmed todavía.
--   select * from public.polla_standings('<tournament_id>'::uuid);
-- ============================================================
