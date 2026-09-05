-- ============================================================
-- 0045 — Polla: PF/PC/diff + streak numérico + day filter
-- ============================================================
-- Extiende polla_standings con:
--   • points_for (PF), points_against (PC), diff (PF - PC)
--   • current_streak (int) + streak_type ('W' | 'L' | NULL) separados
--     en lugar del string "3W" — permite chip color en UI
--   • p_day_filter text default null ('today' = solo partidas finalizadas
--     hoy en TZ America/Caracas)
--
-- Sort order: points_for DESC, wins DESC, win_pct DESC, diff DESC
-- ============================================================

-- Helper: streak count + tipo para un user en una polla/season opcional/day_filter
create or replace function public.polla_user_streak(
  p_user_id uuid,
  p_tournament_id uuid,
  p_season int default null,
  p_day_filter text default null
)
returns table (count int, kind text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_today_start timestamptz;
  v_today_end   timestamptz;
  v_count int := 0;
  v_kind text := null;
  v_won bool;
begin
  if p_season is null then
    select current_season into v_season from public.tournaments where id = p_tournament_id;
  else
    v_season := p_season;
  end if;

  if p_day_filter = 'today' then
    v_today_start := date_trunc('day', (now() at time zone 'America/Caracas'))
                       at time zone 'America/Caracas';
    v_today_end   := v_today_start + interval '1 day';
  end if;

  for v_won in
    select (
      (select sum(score) from public.match_players where match_id = mp.match_id and team = mp.team) >
      (select sum(score) from public.match_players where match_id = mp.match_id and team <> mp.team)
    ) as won
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status in ('confirmed', 'completed')
       and (p_day_filter is null
            or (m.finished_at >= v_today_start and m.finished_at < v_today_end))
     order by m.finished_at desc nulls last, m.created_at desc
  loop
    if v_kind is null then
      v_kind := case when v_won then 'W' else 'L' end;
      v_count := 1;
    elsif (v_kind = 'W' and v_won) or (v_kind = 'L' and not v_won) then
      v_count := v_count + 1;
    else
      exit;
    end if;
  end loop;

  return query select v_count, v_kind;
end;
$$;

grant execute on function public.polla_user_streak(uuid, uuid, int, text) to authenticated;

-- ============================================================
-- polla_standings (drop+recreate por cambio de signature/return)
-- ============================================================

drop function if exists public.polla_standings(uuid, int);

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
       and m.status in ('confirmed', 'completed')
       and (p_day_filter is null
            or (m.finished_at >= v_today_start and m.finished_at < v_today_end))
  ),
  aggregated as (
    select pm.user_id,
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
-- VERIFICACIÓN
--   select * from public.polla_standings('<id>'::uuid);                    -- temporada actual, todas
--   select * from public.polla_standings('<id>'::uuid, 1);                 -- T1 histórica
--   select * from public.polla_standings('<id>'::uuid, null, 'today');     -- solo hoy
-- ============================================================
