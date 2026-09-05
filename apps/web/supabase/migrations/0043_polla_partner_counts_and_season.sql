-- ============================================================
-- 0043 — Polla: partner/rival counts en standings + season param
-- ============================================================
-- Objetivos:
-- 1. `polla_standings` ahora proyecta best_partner_wins/_losses y
--    worst_rival_wins/_losses (antes solo retornaba el nombre, lo que
--    forzaba a la UI a renderizar 0W-0L).
-- 2. Las cuatro funciones aceptan p_season opcional: si es NULL, usan
--    tournaments.current_season (comportamiento previo). Permite ver
--    leaderboards de temporadas pasadas.
--
-- Requiere: 0039 (campos season, current_season) + 0040 (RPCs base).
-- Drop+recreate porque cambia el return type de polla_standings.
-- ============================================================

drop function if exists public.calc_streak(uuid, uuid);
drop function if exists public.polla_best_partner(uuid, uuid);
drop function if exists public.polla_worst_rival(uuid, uuid);
drop function if exists public.polla_standings(uuid);

-- ============================================================
create or replace function public.calc_streak(
  p_user_id uuid,
  p_tournament_id uuid,
  p_season int default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_streak int := 0;
  v_kind text := null;
  r record;
  v_won boolean;
begin
  if p_season is null then
    select current_season into v_season
      from public.tournaments
     where id = p_tournament_id;
  else
    v_season := p_season;
  end if;
  if v_season is null then return '—'; end if;

  for r in
    select m.id as match_id,
           mp.team as my_team,
           (select sum(score) from public.match_players
             where match_id = m.id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = m.id and team <> mp.team) as opp_team_score
      from public.tournament_pairings tp
      join public.matches m on m.id = tp.match_id
      join public.match_players mp on mp.match_id = m.id and mp.user_id = p_user_id
     where tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status = 'confirmed'
     order by m.created_at desc
  loop
    v_won := r.my_team_score > r.opp_team_score;
    if v_kind is null then
      v_kind := case when v_won then 'W' else 'L' end;
      v_streak := 1;
    elsif (v_kind = 'W' and v_won) or (v_kind = 'L' and not v_won) then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;

  if v_kind is null then return '—'; end if;
  return v_streak::text || v_kind;
end;
$$;

grant execute on function public.calc_streak(uuid, uuid, int) to authenticated;

-- ============================================================
create or replace function public.polla_best_partner(
  p_user_id uuid,
  p_tournament_id uuid,
  p_season int default null
)
returns table (
  partner_id      uuid,
  games_together  int,
  wins_together   int,
  win_pct         int
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select coalesce(p_season, current_season) as s
      from public.tournaments where id = p_tournament_id
  ),
  my_matches as (
    select mp.match_id, mp.team, m.created_at,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
       and m.status = 'confirmed'
  ),
  partner_pairs as (
    select pmp.user_id as partner_id,
           mm.my_team_score > mm.opp_team_score as won
      from my_matches mm
      join public.match_players pmp
        on pmp.match_id = mm.match_id
       and pmp.team = mm.team
       and pmp.user_id <> p_user_id
  )
  select partner_id,
         count(*)::int as games_together,
         count(*) filter (where won)::int as wins_together,
         case when count(*) > 0
              then round(count(*) filter (where won) * 100.0 / count(*))::int
              else 0 end as win_pct
    from partner_pairs
   group by partner_id
   order by wins_together desc nulls last, games_together desc nulls last
   limit 1;
$$;

grant execute on function public.polla_best_partner(uuid, uuid, int) to authenticated;

-- ============================================================
create or replace function public.polla_worst_rival(
  p_user_id uuid,
  p_tournament_id uuid,
  p_season int default null
)
returns table (
  rival_id         uuid,
  games_against    int,
  wins_for_rival   int,
  win_pct          int
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select coalesce(p_season, current_season) as s
      from public.tournaments where id = p_tournament_id
  ),
  my_matches as (
    select mp.match_id, mp.team,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
       and m.status = 'confirmed'
  ),
  rival_pairs as (
    select rmp.user_id as rival_id,
           mm.my_team_score < mm.opp_team_score as rival_won
      from my_matches mm
      join public.match_players rmp
        on rmp.match_id = mm.match_id
       and rmp.team <> mm.team
  )
  select rival_id,
         count(*)::int as games_against,
         count(*) filter (where rival_won)::int as wins_for_rival,
         case when count(*) > 0
              then round(count(*) filter (where rival_won) * 100.0 / count(*))::int
              else 0 end as win_pct
    from rival_pairs
   group by rival_id
   order by wins_for_rival desc nulls last, games_against desc nulls last
   limit 1;
$$;

grant execute on function public.polla_worst_rival(uuid, uuid, int) to authenticated;

-- ============================================================
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
         p.username,
         p.display_name,
         p.avatar_url,
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
         -- worst_rival_wins = MIS wins contra ese rival = games_against - wins_for_rival
         -- worst_rival_losses = MIS losses contra ese rival = wins_for_rival
         coalesce(rival_info.games_against - rival_info.wins_for_rival, 0)          as worst_rival_wins,
         coalesce(rival_info.wins_for_rival, 0)                                     as worst_rival_losses
    from public.tournament_players tp
    join public.profiles p on p.id = tp.user_id
    left join aggregated a on a.user_id = tp.user_id
    left join lateral (
      select bp.partner_id,
             bp.games_together,
             bp.wins_together,
             p2.display_name as partner_name
        from public.polla_best_partner(tp.user_id, p_tournament_id, v_season) bp
        left join public.profiles p2 on p2.id = bp.partner_id
    ) partner_info on true
    left join lateral (
      select wr.rival_id,
             wr.games_against,
             wr.wins_for_rival,
             p3.display_name as rival_name
        from public.polla_worst_rival(tp.user_id, p_tournament_id, v_season) wr
        left join public.profiles p3 on p3.id = wr.rival_id
    ) rival_info on true
   where tp.tournament_id = p_tournament_id
   order by total_points desc, wins desc;
end;
$$;

grant execute on function public.polla_standings(uuid, int) to authenticated;

-- ============================================================
-- VERIFICACIÓN
--   select * from public.polla_standings('<tournament_id>'::uuid);              -- temporada actual
--   select * from public.polla_standings('<tournament_id>'::uuid, 1);           -- temporada histórica
-- ============================================================
