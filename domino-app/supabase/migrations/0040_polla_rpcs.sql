-- ============================================================
-- 0040 — RPCs del formato Polla (sub-story 1b)
-- ============================================================
-- Cuatro funciones Postgres para el leaderboard y stats del polla.
-- Todas SECURITY DEFINER y grant a authenticated.
--
-- Idempotente: create or replace function.
-- Requiere migration 0039 ya aplicada (campos season, current_season).
-- ============================================================

create or replace function public.calc_streak(
  p_user_id uuid,
  p_tournament_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_streak int := 0;
  v_kind text := null; -- 'W' o 'L'
  r record;
  v_won boolean;
begin
  select current_season into v_season
    from public.tournaments
   where id = p_tournament_id;
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

grant execute on function public.calc_streak(uuid, uuid) to authenticated;

-- ============================================================
create or replace function public.polla_best_partner(
  p_user_id uuid,
  p_tournament_id uuid
)
returns table (
  partner_id      uuid,
  games_together  int,
  wins_together   int,
  win_pct         numeric
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
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
              then round(count(*) filter (where won) * 100.0 / count(*), 1)
              else 0 end as win_pct
    from partner_pairs
   group by partner_id
   order by wins_together desc nulls last, games_together desc nulls last
   limit 1;
$$;

grant execute on function public.polla_best_partner(uuid, uuid) to authenticated;

-- ============================================================
create or replace function public.polla_worst_rival(
  p_user_id uuid,
  p_tournament_id uuid
)
returns table (
  rival_id         uuid,
  games_against    int,
  wins_for_rival   int,
  win_pct          numeric
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
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
              then round(count(*) filter (where rival_won) * 100.0 / count(*), 1)
              else 0 end as win_pct
    from rival_pairs
   group by rival_id
   order by wins_for_rival desc nulls last, games_against desc nulls last
   limit 1;
$$;

grant execute on function public.polla_worst_rival(uuid, uuid) to authenticated;

-- ============================================================
create or replace function public.polla_standings(p_tournament_id uuid)
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
  worst_rival_id       uuid,
  worst_rival_name     text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
  ),
  player_matches as (
    select mp.user_id, mp.team, mp.score, mp.match_id,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
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
         public.calc_streak(tp.user_id, p_tournament_id) as current_streak,
         (select bp.partner_id  from public.polla_best_partner(tp.user_id, p_tournament_id) bp) as best_partner_id,
         (select p2.display_name from public.profiles p2
           where p2.id = (select bp.partner_id from public.polla_best_partner(tp.user_id, p_tournament_id) bp)
         ) as best_partner_name,
         (select wr.rival_id    from public.polla_worst_rival(tp.user_id, p_tournament_id) wr) as worst_rival_id,
         (select p3.display_name from public.profiles p3
           where p3.id = (select wr.rival_id from public.polla_worst_rival(tp.user_id, p_tournament_id) wr)
         ) as worst_rival_name
    from public.tournament_players tp
    join public.profiles p on p.id = tp.user_id
    left join aggregated a on a.user_id = tp.user_id
   where tp.tournament_id = p_tournament_id
   order by total_points desc, wins desc;
end;
$$;

grant execute on function public.polla_standings(uuid) to authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select * from public.polla_standings('<tournament_id>'::uuid);
--   select public.calc_streak('<user_id>', '<tournament_id>');
-- ============================================================
