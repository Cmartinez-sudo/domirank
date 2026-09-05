-- ============================================================
-- DomiRank · migración 0024
-- Puntos ganados/perdidos por bucket — para mostrar en el leaderboard
-- métricas más completas que solo wins/losses (un jugador puede ganar
-- 100-99 o 100-15; ambos cuentan igual en wins, pero los puntos cuentan
-- la historia del margen).
--
-- Cambios:
--   1. 8 columnas nuevas en profiles: *_points_won, *_points_lost
--   2. apply_match_rating ahora suma puntos desde match_rounds además
--      de incrementar wins/losses/games
--   3. profile_ratings view expone los nuevos campos
--   4. Backfill desde matches confirmed existentes
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Columnas nuevas en profiles
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists singles_points_won     integer not null default 0,
  add column if not exists singles_points_lost    integer not null default 0,
  add column if not exists doubles_points_won     integer not null default 0,
  add column if not exists doubles_points_lost    integer not null default 0,
  add column if not exists d9_singles_points_won  integer not null default 0,
  add column if not exists d9_singles_points_lost integer not null default 0,
  add column if not exists d9_doubles_points_won  integer not null default 0,
  add column if not exists d9_doubles_points_lost integer not null default 0;

-- ────────────────────────────────────────────────────────────
-- 2. apply_match_rating: suma puntos del equipo del jugador (won)
--    y puntos del equipo opuesto (lost), leyendo match_rounds.
-- ────────────────────────────────────────────────────────────
create or replace function public.apply_match_rating(
  p_match_id uuid,
  p_updates  jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match    record;
  v_update   jsonb;
  v_mu_col   text;
  v_sig_col  text;
  v_gms_col  text;
  v_win_col  text;
  v_los_col  text;
  v_pwon_col text;
  v_plos_col text;
  v_user_id  uuid;
  v_rank     int;
  v_won      boolean;
  v_team     int;
  v_pts_won  int;
  v_pts_lost int;
  v_expected int;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'invalid_updates';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_rateable'; end if;
  if v_match.rated_at is not null then return; end if;  -- idempotente

  select count(*) into v_expected from public.match_players where match_id = p_match_id;
  if jsonb_array_length(p_updates) <> v_expected then
    raise exception 'updates_count_mismatch';
  end if;

  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col   := 'd9_singles_mu';            v_sig_col  := 'd9_singles_sigma';
    v_gms_col  := 'd9_singles_games';         v_win_col  := 'd9_singles_wins';
    v_los_col  := 'd9_singles_losses';        v_pwon_col := 'd9_singles_points_won';
    v_plos_col := 'd9_singles_points_lost';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col   := 'd9_doubles_mu';            v_sig_col  := 'd9_doubles_sigma';
    v_gms_col  := 'd9_doubles_games';         v_win_col  := 'd9_doubles_wins';
    v_los_col  := 'd9_doubles_losses';        v_pwon_col := 'd9_doubles_points_won';
    v_plos_col := 'd9_doubles_points_lost';
  elsif v_match.format = 'doubles' then
    v_mu_col   := 'doubles_mu';               v_sig_col  := 'doubles_sigma';
    v_gms_col  := 'doubles_games';            v_win_col  := 'doubles_wins';
    v_los_col  := 'doubles_losses';           v_pwon_col := 'doubles_points_won';
    v_plos_col := 'doubles_points_lost';
  else
    v_mu_col   := 'singles_mu';               v_sig_col  := 'singles_sigma';
    v_gms_col  := 'singles_games';            v_win_col  := 'singles_wins';
    v_los_col  := 'singles_losses';           v_pwon_col := 'singles_points_won';
    v_plos_col := 'singles_points_lost';
  end if;

  for v_update in select * from jsonb_array_elements(p_updates) loop
    v_user_id := (v_update->>'user_id')::uuid;
    v_rank    := (v_update->>'rank')::int;

    if v_user_id is null or v_rank is null or v_rank < 1 then raise exception 'invalid_update_fields'; end if;
    if v_update->>'mu_before' is null or v_update->>'sigma_before' is null
       or v_update->>'mu_after' is null or v_update->>'sigma_after' is null then
      raise exception 'invalid_update_fields';
    end if;
    v_won := v_rank = 1;

    select team into v_team from public.match_players
      where match_id = p_match_id and user_id = v_user_id;
    if v_team is null then raise exception 'user_not_in_match'; end if;

    -- Puntos del equipo del jugador (won) y del resto de equipos (lost).
    -- En 1v1 o 2v2 esto es team del jugador vs el otro team.
    -- En FFA (futuro >2 equipos) won = puntos propios, lost = suma de los demás.
    select coalesce(sum(case when team =  v_team then points else 0 end), 0),
           coalesce(sum(case when team <> v_team then points else 0 end), 0)
      into v_pts_won, v_pts_lost
      from public.match_rounds
     where match_id = p_match_id;

    update public.match_players set
      rank         = v_rank,
      mu_before    = (v_update->>'mu_before')::numeric,
      sigma_before = (v_update->>'sigma_before')::numeric,
      mu_after     = (v_update->>'mu_after')::numeric,
      sigma_after  = (v_update->>'sigma_after')::numeric
    where match_id = p_match_id and user_id = v_user_id;

    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = $2,
          %I = %I + 1,
          %I = %I + $3,
          %I = %I + $4,
          %I = %I + $5,
          %I = %I + $6
        where id = $7
      $q$,
      v_mu_col,   v_sig_col,
      v_gms_col,  v_gms_col,
      v_win_col,  v_win_col,
      v_los_col,  v_los_col,
      v_pwon_col, v_pwon_col,
      v_plos_col, v_plos_col
    ) using
      (v_update->>'mu_after')::numeric,
      (v_update->>'sigma_after')::numeric,
      case when v_won then 1 else 0 end,
      case when v_won then 0 else 1 end,
      v_pts_won,
      v_pts_lost,
      v_user_id;
  end loop;

  update public.matches set rated_at = now() where id = p_match_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid, jsonb) to authenticated;
grant execute on function public.apply_match_rating(uuid, jsonb) to service_role;

-- ────────────────────────────────────────────────────────────
-- 3. Backfill: para todos los matches ya confirmed con rated_at,
--    sumar a profiles los puntos won/lost que faltaron porque el
--    rating se aplicó antes de existir estas columnas.
--
--    Idempotente solo si se corre UNA vez. Como las columnas
--    arrancan en 0 (defaults arriba), este UPDATE no causa doble
--    suma — pero NO debe re-ejecutarse a futuro sin un reset.
-- ────────────────────────────────────────────────────────────
with bucket_points as (
  select
    mp.user_id,
    m.format,
    coalesce(m.set_size, 'd6') as set_size,
    sum(case when mr.team =  mp.team then mr.points else 0 end)::int as pts_won,
    sum(case when mr.team <> mp.team then mr.points else 0 end)::int as pts_lost
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  join public.match_rounds  mr on mr.match_id = m.id
  where m.status = 'confirmed' and m.rated_at is not null
  group by mp.user_id, m.format, coalesce(m.set_size, 'd6')
)
update public.profiles p set
  singles_points_won     = p.singles_points_won     + coalesce(s6_s.pts_won,  0),
  singles_points_lost    = p.singles_points_lost    + coalesce(s6_s.pts_lost, 0),
  doubles_points_won     = p.doubles_points_won     + coalesce(s6_d.pts_won,  0),
  doubles_points_lost    = p.doubles_points_lost    + coalesce(s6_d.pts_lost, 0),
  d9_singles_points_won  = p.d9_singles_points_won  + coalesce(s9_s.pts_won,  0),
  d9_singles_points_lost = p.d9_singles_points_lost + coalesce(s9_s.pts_lost, 0),
  d9_doubles_points_won  = p.d9_doubles_points_won  + coalesce(s9_d.pts_won,  0),
  d9_doubles_points_lost = p.d9_doubles_points_lost + coalesce(s9_d.pts_lost, 0)
from (select distinct user_id from bucket_points) u
left join bucket_points s6_s on s6_s.user_id = u.user_id and s6_s.format = 'singles' and s6_s.set_size = 'd6'
left join bucket_points s6_d on s6_d.user_id = u.user_id and s6_d.format = 'doubles' and s6_d.set_size = 'd6'
left join bucket_points s9_s on s9_s.user_id = u.user_id and s9_s.format = 'singles' and s9_s.set_size = 'd9'
left join bucket_points s9_d on s9_d.user_id = u.user_id and s9_d.format = 'doubles' and s9_d.set_size = 'd9'
where p.id = u.user_id;

-- ────────────────────────────────────────────────────────────
-- 4. Recrear profile_ratings con las nuevas columnas.
--    Mantenemos la lógica de opción A (migración 0023): solo
--    fusiona buckets con games > 0 en el global.
-- ────────────────────────────────────────────────────────────
drop view if exists public.profile_ratings cascade;

create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    case when coalesce(p.singles_games,0)    > 0 then 1.0 / (p.singles_sigma    * p.singles_sigma)    else 0 end as p_s6,
    case when coalesce(p.doubles_games,0)    > 0 then 1.0 / (p.doubles_sigma    * p.doubles_sigma)    else 0 end as p_d6,
    case when coalesce(p.d9_singles_games,0) > 0 then 1.0 / (p.d9_singles_sigma * p.d9_singles_sigma) else 0 end as p_s9,
    case when coalesce(p.d9_doubles_games,0) > 0 then 1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) else 0 end as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.onboarded,
  c.created_at, c.updated_at,

  -- Singles 6-6
  c.singles_mu     as d6_singles_mu,
  c.singles_sigma  as d6_singles_sigma,
  c.singles_games  as d6_singles_games,
  c.singles_wins   as d6_singles_wins,
  c.singles_losses as d6_singles_losses,
  c.singles_points_won  as d6_singles_points_won,
  c.singles_points_lost as d6_singles_points_lost,
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4) as d6_singles_ordinal,
  public.to_display_rating(c.singles_mu - 3 * c.singles_sigma)  as d6_singles_display,

  -- Doubles 6-6
  c.doubles_mu     as d6_doubles_mu,
  c.doubles_sigma  as d6_doubles_sigma,
  c.doubles_games  as d6_doubles_games,
  c.doubles_wins   as d6_doubles_wins,
  c.doubles_losses as d6_doubles_losses,
  c.doubles_points_won  as d6_doubles_points_won,
  c.doubles_points_lost as d6_doubles_points_lost,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4) as d6_doubles_ordinal,
  public.to_display_rating(c.doubles_mu - 3 * c.doubles_sigma) as d6_doubles_display,

  -- Singles 9-9
  c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
  c.d9_singles_wins, c.d9_singles_losses,
  c.d9_singles_points_won, c.d9_singles_points_lost,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4) as d9_singles_ordinal,
  public.to_display_rating(c.d9_singles_mu - 3 * c.d9_singles_sigma) as d9_singles_display,

  -- Doubles 9-9
  c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games,
  c.d9_doubles_wins, c.d9_doubles_losses,
  c.d9_doubles_points_won, c.d9_doubles_points_lost,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4) as d9_doubles_ordinal,
  public.to_display_rating(c.d9_doubles_mu - 3 * c.d9_doubles_sigma) as d9_doubles_display,

  -- DomiRank Global (solo buckets jugados; ver migración 0023)
  case
    when (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9) = 0 then 25.0::numeric(10,4)
    else (
      (c.singles_mu * c.p_s6 + c.doubles_mu * c.p_d6
       + c.d9_singles_mu * c.p_s9 + c.d9_doubles_mu * c.p_d9)
      / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9)
    )::numeric(10,4)
  end as global_mu,
  case
    when (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9) = 0 then 8.3333::numeric(10,4)
    else sqrt(1.0 / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9))::numeric(10,4)
  end as global_sigma,
  public.calc_global_ordinal_v2(
    c.singles_mu, c.singles_sigma, c.singles_games,
    c.doubles_mu, c.doubles_sigma, c.doubles_games,
    c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
    c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games
  ) as global_ordinal,
  public.to_display_rating(
    public.calc_global_ordinal_v2(
      c.singles_mu, c.singles_sigma, c.singles_games,
      c.doubles_mu, c.doubles_sigma, c.doubles_games,
      c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
      c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games
    )
  ) as global_display,

  -- Agregados cross-bucket
  (c.singles_games  + c.doubles_games  + c.d9_singles_games  + c.d9_doubles_games)  as total_games,
  (c.singles_wins   + c.doubles_wins   + c.d9_singles_wins   + c.d9_doubles_wins)   as total_wins,
  (c.singles_losses + c.doubles_losses + c.d9_singles_losses + c.d9_doubles_losses) as total_losses,
  (c.singles_points_won  + c.doubles_points_won
   + c.d9_singles_points_won  + c.d9_doubles_points_won)  as total_points_won,
  (c.singles_points_lost + c.doubles_points_lost
   + c.d9_singles_points_lost + c.d9_doubles_points_lost) as total_points_lost
from combined c;

grant select on public.profile_ratings to anon, authenticated;

-- Recrear el índice sobre global_ordinal (drop cascade lo borró)
drop index if exists profiles_global_ordinal_idx;
create index profiles_global_ordinal_idx on public.profiles (
  public.calc_global_ordinal_v2(
    singles_mu, singles_sigma, singles_games,
    doubles_mu, doubles_sigma, doubles_games,
    d9_singles_mu, d9_singles_sigma, d9_singles_games,
    d9_doubles_mu, d9_doubles_sigma, d9_doubles_games
  ) desc
);
