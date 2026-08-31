-- ============================================================
-- Migración 0106: rating por count_rule (rival / mesa)
-- ============================================================
-- El rating deja de indexarse por SET (d6/d9) y pasa a indexarse por
-- REGLA DE CONTEO (rival/mesa). Esto materializa la decisión del owner:
--   A2 — backfill A2: rival_doubles copia d6_doubles; mesa_doubles empieza
--        de cero con sigma inflado (defaults). Preserva ~90% del rating
--        histórico (partidas rival dominan el bucket d6_doubles).
--   B1 — doble-9 sale del menú de creación. El bucket d9_doubles se
--        CONSERVA en el schema (los matches con set_size='d9' históricos
--        siguen su curso; los nuevos siempre son d6 por UI).
--   C2 — matches históricos con set_size='d9' se ocultan visualmente en la
--        UI (filtrado por queries), pero sus datos se preservan íntegros.
--
-- Route logic en apply_match_rating (post-migración):
--   IF set_size='d9'                       → d9_doubles_* (legacy path)
--   ELSE IF count_rule='mesa'              → mesa_doubles_*
--   ELSE (count_rule='rival' o null d6)    → rival_doubles_*
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + backfill con guardas WHERE
-- rival_doubles_games=0 AND ... para no re-copiar.
-- Reversible parcial: DROP COLUMN revierte cada ADD; los RPCs no se
-- vuelven al estado 0091 automáticamente.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Agregar 16 columnas nuevas en profiles (rival + mesa).
--    Defaults idénticos a los buckets doubles existentes (0004/0025).
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists rival_doubles_mu           numeric(10,4) not null default 25.0000,
  add column if not exists rival_doubles_sigma        numeric(10,4) not null default 8.3333,
  add column if not exists rival_doubles_games        integer       not null default 0,
  add column if not exists rival_doubles_wins         integer       not null default 0,
  add column if not exists rival_doubles_losses       integer       not null default 0,
  add column if not exists rival_doubles_elo          integer       not null default 1500,
  add column if not exists rival_doubles_points_won   integer       not null default 0,
  add column if not exists rival_doubles_points_lost  integer       not null default 0,
  add column if not exists mesa_doubles_mu            numeric(10,4) not null default 25.0000,
  add column if not exists mesa_doubles_sigma         numeric(10,4) not null default 8.3333,
  add column if not exists mesa_doubles_games         integer       not null default 0,
  add column if not exists mesa_doubles_wins          integer       not null default 0,
  add column if not exists mesa_doubles_losses        integer       not null default 0,
  add column if not exists mesa_doubles_elo           integer       not null default 1500,
  add column if not exists mesa_doubles_points_won    integer       not null default 0,
  add column if not exists mesa_doubles_points_lost   integer       not null default 0;

-- ────────────────────────────────────────────────────────────
-- 2. Backfill A2:
--    rival_doubles_* := doubles_* (copy exacto — el rating d6_doubles
--    histórico está dominado por partidas count_rule='rival').
--    mesa_doubles_* se queda con defaults (no hay dato limpio de mesa
--    histórico).
--
--    Guarda de idempotencia: solo copiar cuando rival_doubles_games=0
--    (usuario aún no tiene rating rival calculado, o migración corriendo
--    por primera vez).
-- ────────────────────────────────────────────────────────────
update public.profiles
   set rival_doubles_mu          = doubles_mu,
       rival_doubles_sigma       = doubles_sigma,
       rival_doubles_games       = doubles_games,
       rival_doubles_wins        = doubles_wins,
       rival_doubles_losses      = doubles_losses,
       rival_doubles_elo         = doubles_elo,
       rival_doubles_points_won  = doubles_points_won,
       rival_doubles_points_lost = doubles_points_lost
 where rival_doubles_games = 0
   and doubles_games > 0;

-- ────────────────────────────────────────────────────────────
-- 3. Drop is_rated GENERATED (referencia columnas doubles/d9_doubles).
--    La recrearemos abajo con los 3 buckets (rival + mesa + d9).
-- ────────────────────────────────────────────────────────────
alter table public.profiles drop column if exists is_rated;

-- ────────────────────────────────────────────────────────────
-- 4. Drop view profile_ratings (referencia is_rated + buckets viejos).
--    Recrear abajo con los buckets nuevos + aliases legacy.
-- ────────────────────────────────────────────────────────────
drop view if exists public.profile_ratings cascade;

-- ────────────────────────────────────────────────────────────
-- 5. Recrear GENERATED is_rated con 3 buckets (rival + mesa + d9 legacy).
--    NR_THRESHOLD sigue siendo 5 partidas totales.
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column is_rated boolean generated always as (
    (coalesce(rival_doubles_games, 0)
     + coalesce(mesa_doubles_games, 0)
     + coalesce(d9_doubles_games, 0)) >= 5
  ) stored;

comment on column public.profiles.is_rated is
  'NR state: true once total confirmed matches across the 3 doubles buckets (rival + mesa + d9 legacy) >= 5 (NR_THRESHOLD). GENERATED. Post-0106: rating principal es rival/mesa; d9 se conserva por retrocompat.';

create index if not exists idx_profiles_is_rated
  on public.profiles (is_rated) where is_rated = true;

-- ────────────────────────────────────────────────────────────
-- 6. Recrear calc_global_ordinal_v2 con firma de 3 buckets.
--    Fórmula Bayesiana inverse-variance sobre rival + mesa + d9.
-- ────────────────────────────────────────────────────────────
drop function if exists public.calc_global_ordinal_v2(
  numeric, numeric, int, numeric, numeric, int
) cascade;

create or replace function public.calc_global_ordinal_v2(
  rival_mu numeric, rival_sigma numeric, rival_games int,
  mesa_mu  numeric, mesa_sigma  numeric, mesa_games  int,
  d9_mu    numeric, d9_sigma    numeric, d9_games    int
) returns numeric language sql immutable as $$
  with prec as (
    select
      case when coalesce(rival_games, 0) > 0 then 1.0 / (rival_sigma * rival_sigma) else 0 end as p_rival,
      case when coalesce(mesa_games, 0)  > 0 then 1.0 / (mesa_sigma  * mesa_sigma)  else 0 end as p_mesa,
      case when coalesce(d9_games, 0)    > 0 then 1.0 / (d9_sigma    * d9_sigma)    else 0 end as p_d9
  )
  select case
    when (p_rival + p_mesa + p_d9) = 0 then
      0::numeric(10,4)
    else
      (
        (coalesce(rival_mu, 25) * p_rival
         + coalesce(mesa_mu, 25) * p_mesa
         + coalesce(d9_mu, 25)   * p_d9)
          / (p_rival + p_mesa + p_d9)
        - 3.0 * sqrt(1.0 / (p_rival + p_mesa + p_d9))
      )::numeric(10,4)
  end
  from prec
$$;

-- ────────────────────────────────────────────────────────────
-- 7. Recrear apply_match_rating(uuid, jsonb).
--    Route by count_rule en vez de set_size:
--      d9 → d9_doubles_* (legacy; matches cubanos existentes)
--      mesa → mesa_doubles_*
--      rival / null → rival_doubles_*
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

  -- Post-0106: routing por count_rule (con d9 como override legacy).
  if v_match.format = 'singles' then
    raise exception 'singles_format_removed';
  elsif coalesce(v_match.set_size, 'd6') = 'd9' then
    -- Legacy path: partidas d9 mantienen su bucket histórico.
    v_elo_col  := 'd9_doubles_elo';     v_gms_col  := 'd9_doubles_games';
    v_win_col  := 'd9_doubles_wins';    v_los_col  := 'd9_doubles_losses';
    v_pwon_col := 'd9_doubles_points_won';
    v_plos_col := 'd9_doubles_points_lost';
  elsif v_match.count_rule = 'mesa' then
    v_elo_col  := 'mesa_doubles_elo';   v_gms_col  := 'mesa_doubles_games';
    v_win_col  := 'mesa_doubles_wins';  v_los_col  := 'mesa_doubles_losses';
    v_pwon_col := 'mesa_doubles_points_won';
    v_plos_col := 'mesa_doubles_points_lost';
  else
    -- Default: rival (incluye count_rule='rival' y matches viejos con NULL).
    v_elo_col  := 'rival_doubles_elo';  v_gms_col  := 'rival_doubles_games';
    v_win_col  := 'rival_doubles_wins'; v_los_col  := 'rival_doubles_losses';
    v_pwon_col := 'rival_doubles_points_won';
    v_plos_col := 'rival_doubles_points_lost';
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

  -- Recalculate global_elo: weighted avg de los 3 buckets con games > 0.
  update public.profiles set
    global_elo = coalesce((
      select
        case when sum(g) = 0 then 1500
        else round(sum(e * g)::numeric / sum(g))::int
        end
      from (values
        (rival_doubles_elo, rival_doubles_games),
        (mesa_doubles_elo,  mesa_doubles_games),
        (d9_doubles_elo,    d9_doubles_games)
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
-- 8. Recrear void_match(uuid) con la nueva route logic.
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

  if v_match.format = 'singles' then
    raise exception 'singles_format_removed';
  elsif coalesce(v_match.set_size, 'd6') = 'd9' then
    v_elo_col := 'd9_doubles_elo';    v_gms_col := 'd9_doubles_games';
    v_win_col := 'd9_doubles_wins';   v_los_col := 'd9_doubles_losses';
  elsif v_match.count_rule = 'mesa' then
    v_elo_col := 'mesa_doubles_elo';  v_gms_col := 'mesa_doubles_games';
    v_win_col := 'mesa_doubles_wins'; v_los_col := 'mesa_doubles_losses';
  else
    v_elo_col := 'rival_doubles_elo'; v_gms_col := 'rival_doubles_games';
    v_win_col := 'rival_doubles_wins';v_los_col := 'rival_doubles_losses';
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
        (rival_doubles_elo, rival_doubles_games),
        (mesa_doubles_elo,  mesa_doubles_games),
        (d9_doubles_elo,    d9_doubles_games)
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
-- 9. Recrear view profile_ratings con los buckets nuevos.
--    Mantiene aliases d6_doubles_* (= rival_doubles_*) para no romper
--    consumidores viejos hasta el cleanup post-mig.
-- ────────────────────────────────────────────────────────────
create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    case when coalesce(p.rival_doubles_games, 0) > 0
         then 1.0 / (p.rival_doubles_sigma * p.rival_doubles_sigma) else 0 end as p_rival,
    case when coalesce(p.mesa_doubles_games, 0) > 0
         then 1.0 / (p.mesa_doubles_sigma * p.mesa_doubles_sigma) else 0 end as p_mesa,
    case when coalesce(p.d9_doubles_games, 0) > 0
         then 1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) else 0 end as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.default_count_rule, c.onboarded,
  c.created_at, c.updated_at,

  -- ── Rival doubles (nueva identidad primaria) ──────────────
  c.rival_doubles_elo,
  c.rival_doubles_mu,
  c.rival_doubles_sigma,
  c.rival_doubles_games,
  c.rival_doubles_wins,
  c.rival_doubles_losses,
  c.rival_doubles_points_won,
  c.rival_doubles_points_lost,
  (c.rival_doubles_mu - 3 * c.rival_doubles_sigma)::numeric(10,4) as rival_doubles_ordinal,
  public.to_display_rating_elo(c.rival_doubles_elo)               as rival_doubles_display,

  -- ── Mesa doubles ─────────────────────────────────────────
  c.mesa_doubles_elo,
  c.mesa_doubles_mu,
  c.mesa_doubles_sigma,
  c.mesa_doubles_games,
  c.mesa_doubles_wins,
  c.mesa_doubles_losses,
  c.mesa_doubles_points_won,
  c.mesa_doubles_points_lost,
  (c.mesa_doubles_mu - 3 * c.mesa_doubles_sigma)::numeric(10,4)   as mesa_doubles_ordinal,
  public.to_display_rating_elo(c.mesa_doubles_elo)                as mesa_doubles_display,

  -- ── Aliases legacy d6_doubles_* → rival_doubles_* ────────
  -- (Rating d6+rival era la mayor parte del bucket viejo; el alias
  --  preserva consumidores TS antes de que migren a rival_doubles_*.)
  c.rival_doubles_elo                                              as d6_doubles_elo,
  c.rival_doubles_mu                                               as d6_doubles_mu,
  c.rival_doubles_sigma                                            as d6_doubles_sigma,
  c.rival_doubles_games                                            as d6_doubles_games,
  c.rival_doubles_wins                                             as d6_doubles_wins,
  c.rival_doubles_losses                                           as d6_doubles_losses,
  c.rival_doubles_points_won                                       as d6_doubles_points_won,
  c.rival_doubles_points_lost                                      as d6_doubles_points_lost,
  (c.rival_doubles_mu - 3 * c.rival_doubles_sigma)::numeric(10,4)  as d6_doubles_ordinal,
  public.to_display_rating(c.rival_doubles_mu - 3 * c.rival_doubles_sigma) as d6_doubles_display_legacy,
  public.to_display_rating_elo(c.rival_doubles_elo)                as d6_doubles_display,

  -- ── Doubles 9-9 (legacy, se conserva) ────────────────────
  c.d9_doubles_elo,
  c.d9_doubles_mu, c.d9_doubles_sigma,
  c.d9_doubles_games, c.d9_doubles_wins, c.d9_doubles_losses,
  c.d9_doubles_points_won, c.d9_doubles_points_lost,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4)       as d9_doubles_ordinal,
  public.to_display_rating_elo(c.d9_doubles_elo)                   as d9_doubles_display,

  -- ── DomiRank Global ──────────────────────────────────────
  c.global_elo,
  public.to_display_rating_elo(c.global_elo)                       as global_display,
  case
    when (c.p_rival + c.p_mesa + c.p_d9) = 0 then 25.0::numeric(10,4)
    else (
      (c.rival_doubles_mu * c.p_rival
       + c.mesa_doubles_mu * c.p_mesa
       + c.d9_doubles_mu * c.p_d9)
      / (c.p_rival + c.p_mesa + c.p_d9)
    )::numeric(10,4)
  end as global_mu,
  case
    when (c.p_rival + c.p_mesa + c.p_d9) = 0 then 8.3333::numeric(10,4)
    else sqrt(1.0 / (c.p_rival + c.p_mesa + c.p_d9))::numeric(10,4)
  end as global_sigma,
  public.calc_global_ordinal_v2(
    c.rival_doubles_mu, c.rival_doubles_sigma, c.rival_doubles_games,
    c.mesa_doubles_mu,  c.mesa_doubles_sigma,  c.mesa_doubles_games,
    c.d9_doubles_mu,    c.d9_doubles_sigma,    c.d9_doubles_games
  ) as global_ordinal,

  -- ── Aggregate cross-bucket ────────────────────────────────
  (c.rival_doubles_games  + c.mesa_doubles_games  + c.d9_doubles_games)  as total_games,
  (c.rival_doubles_wins   + c.mesa_doubles_wins   + c.d9_doubles_wins)   as total_wins,
  (c.rival_doubles_losses + c.mesa_doubles_losses + c.d9_doubles_losses) as total_losses,
  (c.rival_doubles_points_won  + c.mesa_doubles_points_won  + c.d9_doubles_points_won)  as total_points_won,
  (c.rival_doubles_points_lost + c.mesa_doubles_points_lost + c.d9_doubles_points_lost) as total_points_lost,

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
-- 10. Recompute global_elo para todos los profiles con la nueva firma.
--     Después del backfill A2, cada profile tiene rival_doubles_* con
--     los stats de d6_doubles y mesa_doubles_* con defaults (games=0).
--     Recalculamos global como weighted avg sobre los buckets con
--     games > 0. Coalesce a 1500 si no hay partidas en ninguno.
-- ────────────────────────────────────────────────────────────
update public.profiles set
  global_elo = coalesce((
    select
      case when sum(g) = 0 then 1500
      else round(sum(e * g)::numeric / sum(g))::int
      end
    from (values
      (rival_doubles_elo, rival_doubles_games),
      (mesa_doubles_elo,  mesa_doubles_games),
      (d9_doubles_elo,    d9_doubles_games)
    ) t(e, g)
    where g > 0
  ), 1500);

-- ────────────────────────────────────────────────────────────
-- 11. Recrear índice global_ordinal con la nueva firma.
-- ────────────────────────────────────────────────────────────
drop index if exists profiles_global_ordinal_idx;
create index profiles_global_ordinal_idx on public.profiles (
  public.calc_global_ordinal_v2(
    rival_doubles_mu, rival_doubles_sigma, rival_doubles_games,
    mesa_doubles_mu,  mesa_doubles_sigma,  mesa_doubles_games,
    d9_doubles_mu,    d9_doubles_sigma,    d9_doubles_games
  ) desc
);

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Backfill A2 correcto (cada profile con doubles_games>0):
--      select id, doubles_games, rival_doubles_games
--        from public.profiles
--       where doubles_games <> rival_doubles_games and doubles_games > 0;
--    Esperado: 0 filas.
--
-- 2. is_rated funciona con 3 buckets:
--      select count(*) from public.profile_ratings
--       where is_rated = true and total_games < 5;
--    Esperado: 0.
--
-- 3. View expone los aliases legacy (d6_doubles_*):
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='profile_ratings'
--         and column_name like 'd6_doubles%';
--    Esperado: ≥ 5 columnas (elo, mu, sigma, games, wins, losses, ...).
--
-- 4. apply_match_rating rutea por count_rule:
--    Insertar match d6+rival confirmed → rival_doubles_games++.
--    Insertar match d6+mesa confirmed → mesa_doubles_games++.
--    Insertar match d9 (legacy) confirmed → d9_doubles_games++.
-- ============================================================
