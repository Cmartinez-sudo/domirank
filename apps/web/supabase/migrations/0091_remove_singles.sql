-- ============================================================
-- 0091 — Eliminar formato 'singles' del sistema (Fase A)
-- ============================================================
-- Refactor Fase A: DomiRank ya no soporta partidas 1v1.
-- Toda partida es de parejas (2v2). Los buckets singles se
-- eliminan permanentemente del schema.
--
-- OPERACIÓN DESTRUCTIVA — no reversible sin restore de backup.
--
-- Pasos:
--   1. Hard delete de matches WHERE format='singles' (cascade).
--   2. CHECK lock-in: matches.format = 'doubles' (única opción).
--   3. Drop view profile_ratings + GENERATED is_rated.
--   4. Drop columnas singles_* y d9_singles_* en profiles (16 cols).
--   5. Recrear is_rated con solo 2 buckets.
--   6. Recrear calc_global_ordinal_v2 con firma de 2 buckets.
--   7. Recrear apply_match_rating sin singles.
--   8. Recrear void_match sin singles.
--   9. Recrear view profile_ratings sin columnas singles.
--  10. Recompute batch de global_elo (weighted avg de 2 buckets).
--  11. Recrear índice global_ordinal.
--
-- Dependencias: 0023 (calc_global_ordinal_v2), 0025 (Elo + view),
-- 0052/0053 (reliability), 0056 (is_rated all buckets).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Hard delete de partidas singles.
--    Cascade a match_players, match_rounds, match_events vía FKs.
-- ────────────────────────────────────────────────────────────
delete from public.matches where format = 'singles';

-- ────────────────────────────────────────────────────────────
-- 2. CHECK lock-in: solo se permite 'doubles' en adelante.
-- ────────────────────────────────────────────────────────────
alter table public.matches drop constraint if exists matches_format_check;
alter table public.matches add constraint matches_format_check check (format = 'doubles');

-- ────────────────────────────────────────────────────────────
-- 3. Drop view profile_ratings (la recreamos en paso 9).
--    Y dropear GENERATED is_rated (referencia columnas singles).
-- ────────────────────────────────────────────────────────────
drop view if exists public.profile_ratings cascade;
alter table public.profiles drop column if exists is_rated;

-- ────────────────────────────────────────────────────────────
-- 4. Drop columnas singles en profiles.
--    CASCADE limpia índices/defaults/triggers que las referencien.
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  drop column if exists singles_mu          cascade,
  drop column if exists singles_sigma       cascade,
  drop column if exists singles_games       cascade,
  drop column if exists singles_wins        cascade,
  drop column if exists singles_losses      cascade,
  drop column if exists singles_elo         cascade,
  drop column if exists singles_points_won  cascade,
  drop column if exists singles_points_lost cascade,
  drop column if exists d9_singles_mu          cascade,
  drop column if exists d9_singles_sigma       cascade,
  drop column if exists d9_singles_games       cascade,
  drop column if exists d9_singles_wins        cascade,
  drop column if exists d9_singles_losses      cascade,
  drop column if exists d9_singles_elo         cascade,
  drop column if exists d9_singles_points_won  cascade,
  drop column if exists d9_singles_points_lost cascade;

-- ────────────────────────────────────────────────────────────
-- 5. Recrear GENERATED is_rated con solo 2 buckets.
--    NR_THRESHOLD sigue siendo 5 partidas totales.
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column is_rated boolean generated always as (
    (coalesce(doubles_games, 0)
     + coalesce(d9_doubles_games, 0)) >= 5
  ) stored;

comment on column public.profiles.is_rated is
  'NR state: true once total confirmed matches across both doubles buckets >= 5 (NR_THRESHOLD). GENERATED. Post-Fase-A: solo cuenta d6_doubles + d9_doubles.';

create index if not exists idx_profiles_is_rated
  on public.profiles (is_rated) where is_rated = true;

-- ────────────────────────────────────────────────────────────
-- 6. Recrear calc_global_ordinal_v2 con firma de 2 buckets.
--    Fórmula Bayesiana inverse-variance idéntica a 0023, solo
--    con menos términos.
-- ────────────────────────────────────────────────────────────
drop function if exists public.calc_global_ordinal_v2(
  numeric, numeric, int, numeric, numeric, int,
  numeric, numeric, int, numeric, numeric, int
) cascade;

create or replace function public.calc_global_ordinal_v2(
  d6_mu numeric, d6_sigma numeric, d6_games int,
  d9_mu numeric, d9_sigma numeric, d9_games int
) returns numeric language sql immutable as $$
  with prec as (
    select
      case when coalesce(d6_games,0) > 0 then 1.0 / (d6_sigma * d6_sigma) else 0 end as p_d6,
      case when coalesce(d9_games,0) > 0 then 1.0 / (d9_sigma * d9_sigma) else 0 end as p_d9
  )
  select case
    when (p_d6 + p_d9) = 0 then
      0::numeric(10,4)
    else
      (
        (coalesce(d6_mu,25) * p_d6 + coalesce(d9_mu,25) * p_d9)
          / (p_d6 + p_d9)
        - 3.0 * sqrt(1.0 / (p_d6 + p_d9))
      )::numeric(10,4)
  end
  from prec
$$;

-- ────────────────────────────────────────────────────────────
-- 7. Recrear apply_match_rating(uuid, jsonb) sin singles.
--    Copia exacta del 0025:115-194 con el array values de
--    global_elo reducido de 4 a 2 buckets.
-- ────────────────────────────────────────────────────────────
create or replace function public.apply_match_rating(p_match_id uuid, p_updates jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match     record;
  v_update    jsonb;
  v_user_id   uuid;
  v_rank      int;
  v_team      smallint;
  v_won       boolean;
  v_pts_won   int;
  v_pts_lost  int;
  v_elo_col   text;
  v_gms_col   text;
  v_win_col   text;
  v_los_col   text;
  v_pwon_col  text;
  v_plos_col  text;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.rated_at is not null then raise exception 'already_rated'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_confirmed'; end if;

  -- Map format + set_size → profile columns.
  -- Post-Fase-A: solo doubles. Si format='singles' llega acá es bug.
  if v_match.format = 'singles' then
    raise exception 'singles_format_removed';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col  := 'd9_doubles_elo';     v_gms_col  := 'd9_doubles_games';
    v_win_col  := 'd9_doubles_wins';    v_los_col  := 'd9_doubles_losses';
    v_pwon_col := 'd9_doubles_points_won';
    v_plos_col := 'd9_doubles_points_lost';
  else
    v_elo_col  := 'doubles_elo';        v_gms_col  := 'doubles_games';
    v_win_col  := 'doubles_wins';       v_los_col  := 'doubles_losses';
    v_pwon_col := 'doubles_points_won';
    v_plos_col := 'doubles_points_lost';
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

    select coalesce(sum(case when team =  v_team then points else 0 end), 0),
           coalesce(sum(case when team <> v_team then points else 0 end), 0)
      into v_pts_won, v_pts_lost
      from public.match_rounds
     where match_id = p_match_id;

    update public.match_players set
      rank       = v_rank,
      elo_before = (v_update->>'elo_before')::int,
      elo_after  = (v_update->>'elo_after')::int,
      k_used     = (v_update->>'k_used')::int
    where match_id = p_match_id and user_id = v_user_id;

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

  -- Recalculate global_elo: weighted avg de los 2 buckets jugados.
  -- coalesce a 1500 cuando el jugador no tiene partidas en ningún bucket
  -- (caso edge: void_match restaurando un primer-partido).
  update public.profiles set
    global_elo = coalesce((
      select
        case when sum(g) = 0 then 1500
        else round(sum(e * g)::numeric / sum(g))::int
        end
      from (values
        (doubles_elo,    doubles_games),
        (d9_doubles_elo, d9_doubles_games)
      ) t(e, g)
      where g > 0
    ), 1500)
  where id in (
    select (v->>'user_id')::uuid from jsonb_array_elements(p_updates) v
  );

  update public.matches set rated_at = now() where id = p_match_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid, jsonb) to authenticated;
grant execute on function public.apply_match_rating(uuid, jsonb) to service_role;

-- ────────────────────────────────────────────────────────────
-- 8. Recrear void_match(uuid) sin singles.
--    Misma estructura que 0025:200-289 pero solo ramas doubles.
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

  -- Post-Fase-A: solo doubles. format='singles' es bug si llega acá.
  if v_match.format = 'singles' then
    raise exception 'singles_format_removed';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col := 'd9_doubles_elo'; v_gms_col := 'd9_doubles_games';
    v_win_col := 'd9_doubles_wins'; v_los_col := 'd9_doubles_losses';
  else
    v_elo_col := 'doubles_elo'; v_gms_col := 'doubles_games';
    v_win_col := 'doubles_wins'; v_los_col := 'doubles_losses';
  end if;

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

  update public.profiles set
    global_elo = coalesce((
      select
        case when sum(g) = 0 then 1500
        else round(sum(e * g)::numeric / sum(g))::int
        end
      from (values
        (doubles_elo,    doubles_games),
        (d9_doubles_elo, d9_doubles_games)
      ) t(e, g)
      where g > 0
    ), 1500)
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
-- 9. Recrear view profile_ratings sin columnas singles.
--    Mantiene reliability_* y la fila completa para compat.
-- ────────────────────────────────────────────────────────────
create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    case when coalesce(p.doubles_games,0)    > 0 then 1.0 / (p.doubles_sigma    * p.doubles_sigma)    else 0 end as p_d6,
    case when coalesce(p.d9_doubles_games,0) > 0 then 1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) else 0 end as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.onboarded,
  c.created_at, c.updated_at,

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

  -- ── Doubles 9-9 ──────────────────────────────────────────
  c.d9_doubles_elo,
  c.d9_doubles_mu, c.d9_doubles_sigma,
  c.d9_doubles_games, c.d9_doubles_wins, c.d9_doubles_losses,
  c.d9_doubles_points_won, c.d9_doubles_points_lost,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4)     as d9_doubles_ordinal,
  public.to_display_rating_elo(c.d9_doubles_elo)                 as d9_doubles_display,

  -- ── DomiRank Global ──────────────────────────────────────
  c.global_elo,
  public.to_display_rating_elo(c.global_elo)                     as global_display,
  case
    when (c.p_d6 + c.p_d9) = 0 then 25.0::numeric(10,4)
    else (
      (c.doubles_mu * c.p_d6 + c.d9_doubles_mu * c.p_d9)
      / (c.p_d6 + c.p_d9)
    )::numeric(10,4)
  end as global_mu,
  case
    when (c.p_d6 + c.p_d9) = 0 then 8.3333::numeric(10,4)
    else sqrt(1.0 / (c.p_d6 + c.p_d9))::numeric(10,4)
  end as global_sigma,
  public.calc_global_ordinal_v2(
    c.doubles_mu, c.doubles_sigma, c.doubles_games,
    c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games
  ) as global_ordinal,

  -- ── Aggregate cross-bucket ────────────────────────────────
  (c.doubles_games  + c.d9_doubles_games)  as total_games,
  (c.doubles_wins   + c.d9_doubles_wins)   as total_wins,
  (c.doubles_losses + c.d9_doubles_losses) as total_losses,
  (c.doubles_points_won  + c.d9_doubles_points_won)  as total_points_won,
  (c.doubles_points_lost + c.d9_doubles_points_lost) as total_points_lost,

  -- ── NR / Reliability ──────────────────────────────────────
  c.is_rated,
  c.reliability_score,
  c.reliability_volume,
  c.reliability_recency,
  c.reliability_attestation,
  c.reliability_diversity,
  c.reliability_updated_at
from combined c;

grant select on public.profile_ratings to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 10. Recompute batch de global_elo para todos los profiles.
--     Después de borrar matches singles, los global_elo actuales
--     reflejaban historia mixta (singles+doubles). Recompute
--     desde cero usando solo los 2 buckets doubles.
--     coalesce a 1500 para perfiles sin partidas en ningún
--     bucket (profiles.global_elo es NOT NULL).
-- ────────────────────────────────────────────────────────────
update public.profiles set
  global_elo = coalesce((
    select
      case when sum(g) = 0 then 1500
      else round(sum(e * g)::numeric / sum(g))::int
      end
    from (values
      (doubles_elo,    doubles_games),
      (d9_doubles_elo, d9_doubles_games)
    ) t(e, g)
    where g > 0
  ), 1500);

-- ────────────────────────────────────────────────────────────
-- 11. Recrear índice global_ordinal con la nueva firma.
-- ────────────────────────────────────────────────────────────
drop index if exists profiles_global_ordinal_idx;
create index profiles_global_ordinal_idx on public.profiles (
  public.calc_global_ordinal_v2(
    doubles_mu, doubles_sigma, doubles_games,
    d9_doubles_mu, d9_doubles_sigma, d9_doubles_games
  ) desc
);

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. No quedan matches singles:
--      select count(*) from public.matches where format = 'singles';
--    Esperado: 0.
--
-- 2. CHECK rechaza singles:
--      insert into public.matches (...) values (...,'singles',...);
--    Esperado: error de CHECK constraint.
--
-- 3. View sin columnas singles:
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='profile_ratings'
--         and column_name like '%singles%';
--    Esperado: 0 filas.
--
-- 4. Columnas singles dropeadas de profiles:
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='profiles'
--         and column_name like '%singles%';
--    Esperado: 0 filas.
--
-- 5. is_rated funciona con 2 buckets:
--      select count(*) from public.profile_ratings
--       where is_rated = true and total_games < 5;
--    Esperado: 0.
-- ============================================================
