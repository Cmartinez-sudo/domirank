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
