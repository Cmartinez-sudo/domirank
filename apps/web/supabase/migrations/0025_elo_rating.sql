-- ============================================================
-- DomiRank · migración 0025
-- Migración OpenSkill → Elo clásico con MoV multiplier FiveThirtyEight.
--
-- Cambios:
--   1. Nuevas columnas de Elo en profiles (1 por bucket)
--   2. Nueva columna global_elo en profiles
--   3. Columnas elo_before / elo_after / k_used en match_players
--   4. Reemplaza apply_match_rating para usar Elo en vez de mu/sigma
--   5. Reemplaza void_match para restaurar elo_before en vez de mu_before
--   6. to_display_rating_elo() — nueva función SQL para escala Elo → 1-20
--   7. Recrea profile_ratings con columnas Elo
--   8. Script de backfill: recalcular Elo desde cero (replay de matches)
--
-- mu/sigma NO se borran todavía — se mantienen nullable para compat.
-- Eliminarlos cuando haya 24h sin issues (migración 0026).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Nuevas columnas de Elo en profiles (idempotente)
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists singles_elo        integer not null default 1500,
  add column if not exists doubles_elo        integer not null default 1500,
  add column if not exists d9_singles_elo     integer not null default 1500,
  add column if not exists d9_doubles_elo     integer not null default 1500,
  add column if not exists global_elo         integer not null default 1500;

-- ────────────────────────────────────────────────────────────
-- 2. Nuevas columnas en match_players para snapshot Elo
-- ────────────────────────────────────────────────────────────
alter table public.match_players
  add column if not exists elo_before  integer,
  add column if not exists elo_after   integer,
  add column if not exists k_used      integer;

-- ────────────────────────────────────────────────────────────
-- 3. Función SQL: Elo → display 1-20
--    1 + ((elo - 1000) / 1200) * 19, clamped [1, 20].
-- ────────────────────────────────────────────────────────────
create or replace function public.to_display_rating_elo(p_elo numeric)
returns numeric(6,1)
language sql immutable parallel safe
as $$
  select greatest(1.0, least(20.0, round((1.0 + ((p_elo - 1000.0) / 1200.0) * 19.0)::numeric, 1)))
$$;

-- ────────────────────────────────────────────────────────────
-- 4. apply_match_rating: nueva versión para Elo
--    Acepta elo_before / elo_after / k_used en p_updates.
--    Mantiene la lógica de points_won/lost de la migración 0024.
-- ────────────────────────────────────────────────────────────
create or replace function public.apply_match_rating(
  p_match_id uuid,
  p_updates  jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match     record;
  v_update    jsonb;
  v_elo_col   text;
  v_gms_col   text;
  v_win_col   text;
  v_los_col   text;
  v_pwon_col  text;
  v_plos_col  text;
  v_user_id   uuid;
  v_rank      int;
  v_won       boolean;
  v_team      int;
  v_pts_won   int;
  v_pts_lost  int;
  v_expected  int;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'invalid_updates';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_rateable'; end if;
  if v_match.rated_at is not null then return; end if; -- idempotente

  select count(*) into v_expected from public.match_players where match_id = p_match_id;
  if jsonb_array_length(p_updates) <> v_expected then
    raise exception 'updates_count_mismatch';
  end if;

  -- Map format + set_size → profile columns
  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col  := 'd9_singles_elo';
    v_gms_col  := 'd9_singles_games';  v_win_col  := 'd9_singles_wins';
    v_los_col  := 'd9_singles_losses'; v_pwon_col := 'd9_singles_points_won';
    v_plos_col := 'd9_singles_points_lost';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col  := 'd9_doubles_elo';
    v_gms_col  := 'd9_doubles_games';  v_win_col  := 'd9_doubles_wins';
    v_los_col  := 'd9_doubles_losses'; v_pwon_col := 'd9_doubles_points_won';
    v_plos_col := 'd9_doubles_points_lost';
  elsif v_match.format = 'doubles' then
    v_elo_col  := 'doubles_elo';
    v_gms_col  := 'doubles_games';     v_win_col  := 'doubles_wins';
    v_los_col  := 'doubles_losses';    v_pwon_col := 'doubles_points_won';
    v_plos_col := 'doubles_points_lost';
  else
    -- singles d6 (default)
    v_elo_col  := 'singles_elo';
    v_gms_col  := 'singles_games';     v_win_col  := 'singles_wins';
    v_los_col  := 'singles_losses';    v_pwon_col := 'singles_points_won';
    v_plos_col := 'singles_points_lost';
  end if;

  for v_update in select * from jsonb_array_elements(p_updates) loop
    v_user_id := (v_update->>'user_id')::uuid;
    v_rank    := (v_update->>'rank')::int;

    if v_user_id is null or v_rank is null or v_rank < 1 then
      raise exception 'invalid_update_fields';
    end if;
    if v_update->>'elo_before' is null or v_update->>'elo_after' is null then
      raise exception 'invalid_update_fields';
    end if;
    v_won := v_rank = 1;

    select team into v_team from public.match_players
      where match_id = p_match_id and user_id = v_user_id;
    if v_team is null then raise exception 'user_not_in_match'; end if;

    -- Points won/lost from match_rounds (same logic as migration 0024)
    select coalesce(sum(case when team =  v_team then points else 0 end), 0),
           coalesce(sum(case when team <> v_team then points else 0 end), 0)
      into v_pts_won, v_pts_lost
      from public.match_rounds
     where match_id = p_match_id;

    -- Snapshot elo_before/elo_after in match_players
    update public.match_players set
      rank       = v_rank,
      elo_before = (v_update->>'elo_before')::int,
      elo_after  = (v_update->>'elo_after')::int,
      k_used     = (v_update->>'k_used')::int
    where match_id = p_match_id and user_id = v_user_id;

    -- Update profile: new elo + games/wins/losses/points counters
    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = %I + 1,
          %I = %I + $2,
          %I = %I + $3,
          %I = %I + $4,
          %I = %I + $5
        where id = $6
      $q$,
      v_elo_col,
      v_gms_col,  v_gms_col,
      v_win_col,  v_win_col,
      v_los_col,  v_los_col,
      v_pwon_col, v_pwon_col,
      v_plos_col, v_plos_col
    ) using
      (v_update->>'elo_after')::int,
      case when v_won then 1 else 0 end,
      case when v_won then 0 else 1 end,
      v_pts_won,
      v_pts_lost,
      v_user_id;
  end loop;

  -- Recalculate global_elo as weighted avg of buckets with games > 0
  update public.profiles set
    global_elo = (
      select
        case when sum(g) = 0 then 1500
        else round(sum(e * g)::numeric / sum(g))::int
        end
      from (values
        (singles_elo,    singles_games),
        (doubles_elo,    doubles_games),
        (d9_singles_elo, d9_singles_games),
        (d9_doubles_elo, d9_doubles_games)
      ) t(e, g)
      where g > 0
    )
  where id in (
    select (v->>'user_id')::uuid from jsonb_array_elements(p_updates) v
  );

  update public.matches set rated_at = now() where id = p_match_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid, jsonb) to authenticated;
grant execute on function public.apply_match_rating(uuid, jsonb) to service_role;

-- ────────────────────────────────────────────────────────────
-- 5. void_match: nueva versión para Elo
--    Restaura elo_before en vez de mu_before / sigma_before.
--    Actualiza también global_elo.
-- ────────────────────────────────────────────────────────────
create or replace function public.void_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match   record;
  v_player  record;
  v_elo_col text;
  v_gms_col text;
  v_win_col text;
  v_los_col text;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.created_by is distinct from auth.uid() then raise exception 'not_authorized'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_voidable'; end if;

  -- Map format + set_size → profile columns
  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col := 'd9_singles_elo'; v_gms_col := 'd9_singles_games';
    v_win_col := 'd9_singles_wins'; v_los_col := 'd9_singles_losses';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col := 'd9_doubles_elo'; v_gms_col := 'd9_doubles_games';
    v_win_col := 'd9_doubles_wins'; v_los_col := 'd9_doubles_losses';
  elsif v_match.format = 'doubles' then
    v_elo_col := 'doubles_elo'; v_gms_col := 'doubles_games';
    v_win_col := 'doubles_wins'; v_los_col := 'doubles_losses';
  else
    v_elo_col := 'singles_elo'; v_gms_col := 'singles_games';
    v_win_col := 'singles_wins'; v_los_col := 'singles_losses';
  end if;

  -- Restore each player's Elo snapshot
  for v_player in
    select user_id, elo_before, rank
    from public.match_players
    where match_id = p_match_id
  loop
    if v_player.elo_before is null then continue; end if;

    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = greatest(%I - 1, 0),
          %I = greatest(%I - $2, 0),
          %I = greatest(%I - $3, 0)
        where id = $4
      $q$,
      v_elo_col,
      v_gms_col, v_gms_col,
      v_win_col, v_win_col,
      v_los_col, v_los_col
    ) using
      v_player.elo_before,
      case when v_player.rank = 1 then 1 else 0 end,
      case when v_player.rank <> 1 then 1 else 0 end,
      v_player.user_id;
  end loop;

  -- Recalculate global_elo for affected players
  update public.profiles set
    global_elo = (
      select
        case when sum(g) = 0 then 1500
        else round(sum(e * g)::numeric / sum(g))::int
        end
      from (values
        (singles_elo,    singles_games),
        (doubles_elo,    doubles_games),
        (d9_singles_elo, d9_singles_games),
        (d9_doubles_elo, d9_doubles_games)
      ) t(e, g)
      where g > 0
    )
  where id in (
    select user_id from public.match_players where match_id = p_match_id
  );

  update public.matches
  set status = 'void', rated_at = null
  where id = p_match_id;
end;
$$;

grant execute on function public.void_match(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. Recrea profile_ratings con columnas Elo.
--    Mantiene todas las columnas legacy (mu/sigma/ordinal) para
--    compat con código antiguo hasta la migración 0026.
-- ────────────────────────────────────────────────────────────
drop view if exists public.profile_ratings cascade;

create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    -- Precision weights (legacy, para compat)
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

  -- ── Singles 6-6 ──────────────────────────────────────────
  c.singles_elo                                                  as d6_singles_elo,
  c.singles_mu                                                   as d6_singles_mu,
  c.singles_sigma                                                as d6_singles_sigma,
  c.singles_games                                                as d6_singles_games,
  c.singles_wins                                                 as d6_singles_wins,
  c.singles_losses                                               as d6_singles_losses,
  c.singles_points_won                                           as d6_singles_points_won,
  c.singles_points_lost                                          as d6_singles_points_lost,
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4)           as d6_singles_ordinal,
  public.to_display_rating(c.singles_mu - 3 * c.singles_sigma)  as d6_singles_display_legacy,
  public.to_display_rating_elo(c.singles_elo)                    as d6_singles_display,

  -- ── Doubles 6-6 ──────────────────────────────────────────
  c.doubles_elo                                                  as d6_doubles_elo,
  c.doubles_mu                                                   as d6_doubles_mu,
  c.doubles_sigma                                                as d6_doubles_sigma,
  c.doubles_games                                                as d6_doubles_games,
  c.doubles_wins                                                 as d6_doubles_wins,
  c.doubles_losses                                               as d6_doubles_losses,
  c.doubles_points_won                                           as d6_doubles_points_won,
  c.doubles_points_lost                                          as d6_doubles_points_lost,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4)           as d6_doubles_ordinal,
  public.to_display_rating(c.doubles_mu - 3 * c.doubles_sigma)  as d6_doubles_display_legacy,
  public.to_display_rating_elo(c.doubles_elo)                    as d6_doubles_display,

  -- ── Singles 9-9 ──────────────────────────────────────────
  c.d9_singles_elo,
  c.d9_singles_mu, c.d9_singles_sigma,
  c.d9_singles_games, c.d9_singles_wins, c.d9_singles_losses,
  c.d9_singles_points_won, c.d9_singles_points_lost,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4)     as d9_singles_ordinal,
  public.to_display_rating_elo(c.d9_singles_elo)                 as d9_singles_display,

  -- ── Doubles 9-9 ──────────────────────────────────────────
  c.d9_doubles_elo,
  c.d9_doubles_mu, c.d9_doubles_sigma,
  c.d9_doubles_games, c.d9_doubles_wins, c.d9_doubles_losses,
  c.d9_doubles_points_won, c.d9_doubles_points_lost,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4)     as d9_doubles_ordinal,
  public.to_display_rating_elo(c.d9_doubles_elo)                 as d9_doubles_display,

  -- ── DomiRank Global (Elo weighted avg) ───────────────────
  c.global_elo,
  public.to_display_rating_elo(c.global_elo)                     as global_display,
  -- Legacy OpenSkill global (kept for compat until 0026)
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

  -- ── Aggregate cross-bucket ────────────────────────────────
  (c.singles_games  + c.doubles_games  + c.d9_singles_games  + c.d9_doubles_games)  as total_games,
  (c.singles_wins   + c.doubles_wins   + c.d9_singles_wins   + c.d9_doubles_wins)   as total_wins,
  (c.singles_losses + c.doubles_losses + c.d9_singles_losses + c.d9_doubles_losses) as total_losses,
  (c.singles_points_won  + c.doubles_points_won
   + c.d9_singles_points_won  + c.d9_doubles_points_won)  as total_points_won,
  (c.singles_points_lost + c.doubles_points_lost
   + c.d9_singles_points_lost + c.d9_doubles_points_lost) as total_points_lost
from combined c;

grant select on public.profile_ratings to anon, authenticated;

-- Index for Elo-based leaderboard ordering
create index if not exists profiles_global_elo_idx
  on public.profiles (global_elo desc);

-- ────────────────────────────────────────────────────────────
-- 7. recalculate_all_elo() — resets all Elo and replays every
--    confirmed match in chronological order via Node script.
--    This SQL function resets state; the actual replay must be
--    run via scripts/recalculate-elo.ts (Node).
--
--    pg_net is NOT used here — Node handles the computation
--    because Elo math lives in TypeScript (rating.ts).
-- ────────────────────────────────────────────────────────────
create or replace function public.reset_all_elo()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Reset all bucket Elo values to defaults
  update public.profiles set
    singles_elo    = 1500,
    doubles_elo    = 1500,
    d9_singles_elo = 1500,
    d9_doubles_elo = 1500,
    global_elo     = 1500;

  -- Clear Elo snapshots from match_players
  update public.match_players set
    elo_before = null,
    elo_after  = null,
    k_used     = null;

  -- Clear rated_at so recalculate-elo.ts can re-process all matches
  update public.matches set rated_at = null where status = 'confirmed';
end;
$$;

grant execute on function public.reset_all_elo() to service_role;
