-- ============================================================
-- 0051 — Dual leaderboard: session_day + RPCs diarias (F2.1)
-- ============================================================
-- F2.1 del feature DUAL_LEADERBOARD (spec en PERSONA_ERIK_DUAL_LEADERBOARD.md).
--
-- Contexto: la "Liga continua" (continuous_league) tiene sesiones de juego
-- entre amigos que cruzan medianoche. Para mostrar "ganador del día"
-- queremos un cutoff a las 5am en TZ America/Caracas (un partido jugado
-- a las 2am cuenta para el día anterior).
--
-- Esta migración agrega 4 funciones SQL:
--   1. session_day(ts, tz)                       — pura, immutable, cutoff 5am.
--   2. calc_day_streak(user, tournament, day)    — streak restringido al día.
--   3. continuous_league_daily_standings(...)    — standings del día (default hoy).
--   4. continuous_league_winners_history(...)    — historial cronológico de #1 del día.
--
-- Decisiones de schema (confirmadas con owner):
--   - Usar matches.finished_at (NO finalized_at; ese nombre no existe en
--     DomiRank, viene de un typo en el spec doc).
--   - Determinar ganador via aggregation de match_rounds (NO winner_side, que
--     tampoco existe). Mismo patrón canónico que continuous_league_standings
--     después del fix de mig 0046 (PF/PC doubling bug).
--
-- Dependencias:
--   - 0047 (rename tabla/columnas polla → continuous_league)
--   - 0048 (rename RPCs polla_* → continuous_league_*)
--   - 0049 (tournaments.tables_count + attestation columns)
--   - 0050 (backfill attestation)
--
-- Patrones copiados de migraciones previas:
--   - 0046: aggregation de match_rounds para evitar el doubling bug.
--   - 0048: estructura general, security definer + set search_path,
--           citext casts (username/display_name), grants.
--   - 0045: lógica del streak loop.
-- ============================================================

-- ============================================================
-- 1. session_day(p_ts, p_tz)
-- ============================================================
-- Convierte timestamptz a la "fecha de sesión" con cutoff de 5am.
-- Una partida jugada entre 00:00 y 04:59 (TZ local) cuenta para el día
-- anterior, así una sesión que cruza medianoche queda agrupada.
--
-- Ejemplos (TZ America/Caracas = UTC-4):
--   2026-05-30 21:00 local → 21:00 - 5h = 16:00 → 2026-05-30
--   2026-05-31 01:00 local → 01:00 - 5h = -04:00 → prev day 20:00 → 2026-05-30
--   2026-05-31 06:00 local → 06:00 - 5h = 01:00 → 2026-05-31
--
-- IMMUTABLE: para que pueda usarse en índices y group by sin re-evaluar.
create or replace function public.session_day(
  p_ts timestamptz,
  p_tz text default 'America/Caracas'
)
returns date
language sql
immutable
as $$
  select (p_ts at time zone p_tz - interval '5 hours')::date;
$$;

grant execute on function public.session_day(timestamptz, text) to authenticated;

-- ============================================================
-- 2. calc_day_streak(p_user_id, p_tournament_id, p_session_day)
-- ============================================================
-- Streak (W/L racha actual) restringido a partidas terminadas en un
-- session_day específico. Retorna text formateado: "3W", "1L", o "—"
-- si no jugó ese día.
--
-- Lógica copiada de continuous_league_user_streak (mig 0048 / 0045)
-- pero con WHERE adicional filtrando por session_day(m.finished_at) = p_session_day.
-- Determina W/L via match_rounds aggregation (NO match_players.score,
-- que en doubles está duplicado — ver 0046).
create or replace function public.calc_day_streak(
  p_user_id uuid,
  p_tournament_id uuid,
  p_session_day date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_count int := 0;
  v_kind text := null;
  v_won bool;
begin
  select current_season into v_season
    from public.tournaments where id = p_tournament_id;

  for v_won in
    select (
      coalesce((select sum(points)::int from public.match_rounds
                 where match_id = mp.match_id and team = mp.team), 0) >
      coalesce((select sum(points)::int from public.match_rounds
                 where match_id = mp.match_id and team <> mp.team), 0)
    ) as won
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status = 'confirmed'
       and public.session_day(m.finished_at) = p_session_day
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

  if v_kind is null then
    return '—';
  end if;

  return v_count::text || v_kind;
end;
$$;

grant execute on function public.calc_day_streak(uuid, uuid, date) to authenticated;

-- ============================================================
-- 3. continuous_league_daily_standings(p_tournament_id, p_session_day)
-- ============================================================
-- Standings filtradas a un solo session_day. Si p_session_day es NULL,
-- usa session_day(now()) (= "hoy" con cutoff 5am).
--
-- Diferencias vs continuous_league_standings:
--   - Filtra por status='confirmed' y session_day(m.finished_at) = p_session_day.
--   - Usa match_rounds para PF/PC y W/L (mismo patrón que 0046).
--   - Nuevo campo is_day_winner: TRUE solo en el #1 con games_played > 0.
--     row_number() over (...) ordena por total_points desc, wins desc,
--     games_played desc. Si games_played=0, FORZAR FALSE (incluso si
--     casualmente quedó en rank 1 por todos los ceros empatados).
--   - Order final: total_points desc, wins desc, games_played desc.
--   - Cast username/display_name a text para evitar el bug de citext (mig 0044).
create or replace function public.continuous_league_daily_standings(
  p_tournament_id uuid,
  p_session_day date default null
)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  total_points     int,
  wins             int,
  losses           int,
  win_pct          int,
  games_played     int,
  current_streak   text,
  is_day_winner    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_day    date;
begin
  select current_season into v_season
    from public.tournaments where id = p_tournament_id;

  v_day := coalesce(p_session_day, public.session_day(now()));

  return query
  with player_matches as (
    -- IMPORTANTE: my_team_score y opp_team_score salen de match_rounds (source
    -- of truth), no de match_players.score (que está duplicado en doubles).
    -- Filtramos por session_day del finished_at, así una partida cerrada a las
    -- 2am cuenta para el día anterior.
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
       and m.status = 'confirmed'
       and public.session_day(m.finished_at) = v_day
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
  ),
  ranked as (
    select tp.user_id,
           p.username::text     as username,
           p.display_name::text as display_name,
           p.avatar_url::text   as avatar_url,
           coalesce(a.total_points, 0) as total_points,
           coalesce(a.wins, 0)         as wins,
           coalesce(a.losses, 0)       as losses,
           coalesce(a.win_pct, 0)      as win_pct,
           coalesce(a.games_played, 0) as games_played,
           public.calc_day_streak(tp.user_id, p_tournament_id, v_day) as current_streak,
           row_number() over (
             order by coalesce(a.total_points, 0) desc,
                      coalesce(a.wins, 0) desc,
                      coalesce(a.games_played, 0) desc
           ) as rn
      from public.tournament_players tp
      join public.profiles p on p.id = tp.user_id
      left join aggregated a on a.user_id = tp.user_id
     where tp.tournament_id = p_tournament_id
  )
  select r.user_id,
         r.username,
         r.display_name,
         r.avatar_url,
         r.total_points,
         r.wins,
         r.losses,
         r.win_pct,
         r.games_played,
         r.current_streak,
         -- is_day_winner: solo TRUE en el rank 1 Y si jugó al menos 1 partida.
         -- Si nadie jugó ese día, row_number() asigna rank 1 a alguien por
         -- empate de ceros — pero games_played=0 hace que el resultado sea
         -- FALSE igual. Así winners_history no devuelve falsos positivos.
         (r.rn = 1 and r.games_played > 0) as is_day_winner
    from ranked r
   order by r.total_points desc, r.wins desc, r.games_played desc;
end;
$$;

grant execute on function public.continuous_league_daily_standings(uuid, date) to authenticated;

-- ============================================================
-- 4. continuous_league_winners_history(p_tournament_id, p_limit)
-- ============================================================
-- Historial cronológico de ganadores del día (más recientes primero).
--
-- Estrategia (lateral join, más eficiente que loop plpgsql):
--   1. Distinct session_days con matches confirmed en la season actual.
--   2. Por cada day, llamar continuous_league_daily_standings(...).
--   3. Filtrar is_day_winner = true (1 fila por day, el #1).
--   4. Order by session_day desc, limit p_limit.
create or replace function public.continuous_league_winners_history(
  p_tournament_id uuid,
  p_limit int default 50
)
returns table (
  session_day          date,
  winner_id            uuid,
  winner_username      text,
  winner_display_name  text,
  winner_avatar_url    text,
  total_points         int,
  matches_played       int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
begin
  select current_season into v_season
    from public.tournaments where id = p_tournament_id;

  return query
  with distinct_days as (
    select distinct public.session_day(m.finished_at) as sd
      from public.tournament_pairings tp
      join public.matches m on m.id = tp.match_id
     where tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status = 'confirmed'
       and m.finished_at is not null
     order by sd desc
     limit p_limit
  )
  select dd.sd                  as session_day,
         cls.user_id            as winner_id,
         cls.username           as winner_username,
         cls.display_name       as winner_display_name,
         cls.avatar_url         as winner_avatar_url,
         cls.total_points       as total_points,
         cls.games_played       as matches_played
    from distinct_days dd
    cross join lateral public.continuous_league_daily_standings(p_tournament_id, dd.sd) cls
   where cls.is_day_winner = true
   order by dd.sd desc;
end;
$$;

grant execute on function public.continuous_league_winners_history(uuid, int) to authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Las 4 funciones existen + grants OK:
--      select n.nspname, p.proname, pg_get_function_arguments(p.oid) as args
--        from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('session_day',
--                           'calc_day_streak',
--                           'continuous_league_daily_standings',
--                           'continuous_league_winners_history')
--       order by p.proname;
--    Esperado: 4 filas.
--
-- 2. session_day cutoff a 5am (Caracas = UTC-4 sin DST):
--      select public.session_day('2026-05-30 21:00-04'::timestamptz);  -- 2026-05-30
--      select public.session_day('2026-05-31 01:00-04'::timestamptz);  -- 2026-05-30
--      select public.session_day('2026-05-31 06:00-04'::timestamptz);  -- 2026-05-31
--
-- 3. Smoke test daily standings (torneo continuous_league con datos del día):
--      select user_id, total_points, wins, games_played, current_streak, is_day_winner
--        from public.continuous_league_daily_standings('<id>'::uuid);
--    Esperado:
--      - is_day_winner = true EXACTAMENTE en 1 fila (la #1 con games > 0).
--      - is_day_winner = false en todos los jugadores con games_played = 0.
--
-- 4. Smoke test winners history:
--      select * from public.continuous_league_winners_history('<id>'::uuid, 10);
--    Esperado: filas ordenadas por session_day DESC, 1 fila por día con
--    matches confirmed en esa season.
--
-- 5. Smoke test calc_day_streak:
--      select public.calc_day_streak('<user>'::uuid, '<tournament>'::uuid, current_date);
--    Esperado: text "NW" / "NL" / "—".
-- ============================================================
