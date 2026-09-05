-- ============================================================
-- 0048 — Rename RPCs y view polla_* → continuous_league_*
-- ============================================================
-- F1.2 del refactor TOURNAMENT_WIZARD_REFACTOR.md.
--
-- Esta migración renombra (en realidad: drop + recreate, porque Postgres
-- no tiene ALTER FUNCTION RENAME para funciones con default args)
-- las RPCs y la view del formato polla a sus equivalentes con prefijo
-- continuous_league_*. También renombra la RLS policy que F1.1 dejó con
-- el nombre viejo.
--
-- Cuerpos copiados AS-IS de:
--   - 0046 (latest polla_standings con fix de PF/PC doubling)
--   - 0045 (polla_user_streak con day filter)
--   - 0043 (latest polla_best_partner, polla_worst_rival con p_season default null)
--
-- IMPORTANTE: el orden importa porque continuous_league_standings depende de
-- continuous_league_user_streak/best_partner/worst_rival via lateral joins.
-- Primero creamos las helpers, después la principal. El DROP se hace todo
-- al final para no romper dependencias durante el create.
--
-- Idempotente: drop ... if exists en todo.
-- ============================================================

-- ============================================================
-- 1. Crear nuevas funciones con prefijo continuous_league_
-- ============================================================

-- 1a. continuous_league_user_streak (de mig 0045)
create or replace function public.continuous_league_user_streak(
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

grant execute on function public.continuous_league_user_streak(uuid, uuid, int, text) to authenticated;

-- ============================================================
-- 1b. continuous_league_best_partner (de mig 0040)
create or replace function public.continuous_league_best_partner(
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
    -- Note: tied matches (my_team_score = opp_team_score) evaluate `won` to FALSE.
    -- NULL scores (no match_players rows for a team) would evaluate to NULL and
    -- be excluded from wins count by `filter (where won)`, but still counted
    -- in games_together. Domino ties are unusual; this edge case is documented.
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
   -- Sort by absolute wins (volume-weighted "best"), not win rate.
   -- A partner with 3W of 10 games ranks above a partner with 2W of 2 games.
   -- Tie-break by games together (more shared experience = "better").
   order by wins_together desc nulls last, games_together desc nulls last
   limit 1;
$$;

grant execute on function public.continuous_league_best_partner(uuid, uuid, int) to authenticated;

-- ============================================================
-- 1c. continuous_league_worst_rival (de mig 0040)
create or replace function public.continuous_league_worst_rival(
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
    -- Note: tied matches (my_team_score = opp_team_score) evaluate `rival_won` to FALSE.
    -- NULL scores (no match_players rows for a team) would evaluate to NULL and
    -- be excluded from wins count by `filter (where rival_won)`, but still counted
    -- in games_against. Domino ties are unusual; this edge case is documented.
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
   -- Sort by absolute wins (volume-weighted "worst"), not win rate.
   -- A rival with 3W of 10 games ranks above a rival with 2W of 2 games.
   -- Tie-break by games against (more shared experience = "worse").
   order by wins_for_rival desc nulls last, games_against desc nulls last
   limit 1;
$$;

grant execute on function public.continuous_league_worst_rival(uuid, uuid, int) to authenticated;

-- ============================================================
-- 1d. continuous_league_standings (de mig 0046 — latest, con fix PF/PC doubling)
create or replace function public.continuous_league_standings(
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
      select * from public.continuous_league_user_streak(tp.user_id, p_tournament_id, v_season, p_day_filter)
    ) streak_info on true
    left join lateral (
      select bp.partner_id,
             bp.games_together,
             bp.wins_together,
             p2.display_name::text as partner_name
        from public.continuous_league_best_partner(tp.user_id, p_tournament_id, v_season) bp
        left join public.profiles p2 on p2.id = bp.partner_id
    ) partner_info on true
    left join lateral (
      select wr.rival_id,
             wr.games_against,
             wr.wins_for_rival,
             p3.display_name::text as rival_name
        from public.continuous_league_worst_rival(tp.user_id, p_tournament_id, v_season) wr
        left join public.profiles p3 on p3.id = wr.rival_id
    ) rival_info on true
   where tp.tournament_id = p_tournament_id
   order by points_for desc, wins desc, win_pct desc, diff desc;
end;
$$;

grant execute on function public.continuous_league_standings(uuid, int, text) to authenticated;

-- ============================================================
-- 2. Recrear view: polla_current_season_pairings → continuous_league_current_season_pairings
-- ============================================================
-- Definición copiada AS-IS de mig 0039.

create or replace view public.continuous_league_current_season_pairings as
  select tp.*
    from public.tournament_pairings tp
    join public.tournaments t on t.id = tp.tournament_id
   where tp.season = t.current_season;

-- ============================================================
-- 3. Renombrar RLS policy: polla_pairings_insert_participant → continuous_league_pairings_insert_participant
-- ============================================================
-- F1.1 actualizó el predicado pero dejó el nombre viejo. Ahora renombramos.
-- Postgres soporta ALTER POLICY ... RENAME directo.

alter policy polla_pairings_insert_participant
  on public.tournament_pairings
  rename to continuous_league_pairings_insert_participant;

-- ============================================================
-- 4. DROP de las funciones y view viejas (clean slate)
-- ============================================================
-- F1.1 + F1.2 land juntos en la app: los call sites del cliente ya apuntan a
-- los nombres nuevos. Las funciones viejas son dead code inmediatamente
-- después del deploy.

drop function if exists public.polla_standings(uuid, int, text);
drop function if exists public.polla_standings(uuid, int);
drop function if exists public.polla_standings(uuid);

drop function if exists public.polla_user_streak(uuid, uuid, int, text);
drop function if exists public.polla_user_streak(uuid, uuid, int);
drop function if exists public.polla_user_streak(uuid, uuid);

drop function if exists public.polla_best_partner(uuid, uuid, int);
drop function if exists public.polla_best_partner(uuid, uuid);

drop function if exists public.polla_worst_rival(uuid, uuid, int);
drop function if exists public.polla_worst_rival(uuid, uuid);

drop view if exists public.polla_current_season_pairings;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Funciones nuevas existen + grants OK:
--      select n.nspname, p.proname, pg_get_function_arguments(p.oid) as args
--        from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname like 'continuous_league_%'
--       order by p.proname, p.oid;
--    Esperado: 4 filas (standings, user_streak, best_partner, worst_rival).
--
-- 2. Funciones viejas NO existen:
--      select count(*) from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname like 'polla_%';
--    Esperado: 0.
--
-- 3. View nueva existe + view vieja no:
--      select viewname from pg_views
--       where schemaname = 'public'
--         and viewname in ('polla_current_season_pairings',
--                          'continuous_league_current_season_pairings');
--    Esperado: solo continuous_league_current_season_pairings.
--
-- 4. RLS policy renombrada:
--      select polname from pg_policy
--       where polrelid = 'public.tournament_pairings'::regclass
--         and polname like '%pairings_insert_participant';
--    Esperado: continuous_league_pairings_insert_participant (solo).
--
-- 5. Smoke test funcional (en torneo con datos):
--      select * from public.continuous_league_standings('<id>'::uuid) limit 5;
-- ============================================================
