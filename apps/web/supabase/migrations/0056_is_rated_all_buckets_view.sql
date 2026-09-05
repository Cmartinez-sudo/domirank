-- ============================================================
-- 0056 — is_rated cuenta TODOS los buckets + expone reliability_* en view
-- ============================================================
-- Sprint Reliability NR — F2.1 del RELIABILITY_NR_HOW_IT_WORKS.md.
--
-- Dos correcciones:
--
-- 1. is_rated en mig 0052 contaba solo singles_games + doubles_games (6-6).
--    El leaderboard global usa total_games = los 4 buckets. Inconsistencia:
--    un user solo-9-9 con 10 partidas aparecería en leaderboard pero
--    is_rated=false. Corregimos a los 4 buckets para que ambos coincidan.
--
--    Nadie tiene d9 games hoy en prod (12 users backfilled, todos 6-6),
--    por lo que el cambio es safe a nivel de data. Pero deja el contract
--    consistent para cuando d9 crezca.
--
-- 2. profile_ratings view no expone is_rated ni reliability_*. Para que
--    el leaderboard pueda filtrar por is_rated=true sin hacer JOIN
--    adicional, agregamos las 7 columnas al view.
--
-- Dependencias: 0025 (Elo view), 0052 (columnas), 0053 (compute fn).
-- ============================================================

-- 1. Recompute is_rated con expresión correcta.
--    GENERATED column requiere DROP + ADD; no se puede ALTER expression.
--    Como la columna es STORED no-volatile, drop+re-add es O(N) write.
--    Para 19 profiles es instantáneo.

alter table public.profiles drop column if exists is_rated;

alter table public.profiles
  add column is_rated boolean generated always as (
    (coalesce(singles_games, 0)
     + coalesce(doubles_games, 0)
     + coalesce(d9_singles_games, 0)
     + coalesce(d9_doubles_games, 0)) >= 5
  ) stored;

comment on column public.profiles.is_rated is
  'NR state: true once total confirmed matches across ALL 4 buckets >= 5 (NR_THRESHOLD). GENERATED.';

-- Recrear índice parcial (drop column lo eliminó).
create index if not exists idx_profiles_is_rated
  on public.profiles (is_rated) where is_rated = true;

-- 2. Recrear profile_ratings con reliability_* + is_rated expuestos.
--    Mantiene 100% de las columnas existentes — solo agrega 7 al final.

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

  -- ── DomiRank Global ──────────────────────────────────────
  c.global_elo,
  public.to_display_rating_elo(c.global_elo)                     as global_display,
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
   + c.d9_singles_points_lost + c.d9_doubles_points_lost) as total_points_lost,

  -- ── NR / Reliability (sprint Reliability NR) ─────────────
  c.is_rated,
  c.reliability_score,
  c.reliability_volume,
  c.reliability_recency,
  c.reliability_attestation,
  c.reliability_diversity,
  c.reliability_updated_at
from combined c;

grant select on public.profile_ratings to anon, authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. is_rated nueva expresión:
--      select pg_get_expr(adbin, adrelid) from pg_attrdef
--       where adrelid = 'public.profiles'::regclass
--         and adnum = (select attnum from pg_attribute
--                       where attrelid='public.profiles'::regclass
--                         and attname='is_rated');
--    Esperado: contiene "d9_singles_games" + "d9_doubles_games".
--
-- 2. View expone los 7 campos nuevos:
--      select column_name from information_schema.columns
--       where table_schema='public' and table_name='profile_ratings'
--         and column_name in ('is_rated','reliability_score','reliability_volume',
--                             'reliability_recency','reliability_attestation',
--                             'reliability_diversity','reliability_updated_at');
--    Esperado: 7 filas.
--
-- 3. Coherencia is_rated vs total_games:
--      select count(*) from public.profile_ratings
--       where is_rated = true and total_games < 5;
--    Esperado: 0.
-- ============================================================
