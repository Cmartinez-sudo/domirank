-- ============================================================
-- DomiRank · migración 0023
-- DomiRank Global ahora solo fusiona los buckets que el jugador
-- HA JUGADO (games > 0). Buckets vacíos quedan fuera, no jalan
-- el global hacia μ=25 default.
--
-- Antes: jugador que solo juega d6_doubles (μ=32) veía global ≈ 29
--   porque los 3 buckets vacíos arrastraban hacia el default.
-- Después: su global == su d6_doubles. Si nunca juega un formato,
--   ese formato no afecta su número global.
--
-- Edge case: jugador sin partidas en ningún bucket — usa defaults
-- (μ=25, σ=8.33) directos. No aparece en el leaderboard global
-- igualmente porque DOMIRANK_MIN_GAMES filtra total_games < 5.
-- ============================================================

create or replace function public.calc_global_ordinal_v2(
  s6_mu numeric, s6_sigma numeric, s6_games int,
  d6_mu numeric, d6_sigma numeric, d6_games int,
  s9_mu numeric, s9_sigma numeric, s9_games int,
  d9_mu numeric, d9_sigma numeric, d9_games int
) returns numeric language sql immutable as $$
  with prec as (
    select
      case when coalesce(s6_games,0) > 0 then 1.0 / (s6_sigma * s6_sigma) else 0 end as p_s6,
      case when coalesce(d6_games,0) > 0 then 1.0 / (d6_sigma * d6_sigma) else 0 end as p_d6,
      case when coalesce(s9_games,0) > 0 then 1.0 / (s9_sigma * s9_sigma) else 0 end as p_s9,
      case when coalesce(d9_games,0) > 0 then 1.0 / (d9_sigma * d9_sigma) else 0 end as p_d9
  )
  select case
    when (p_s6 + p_d6 + p_s9 + p_d9) = 0 then
      -- Jugador sin partidas: defaults μ=25, σ=8.33 → ordinal = 0
      0::numeric(10,4)
    else
      (
        (coalesce(s6_mu,25) * p_s6 + coalesce(d6_mu,25) * p_d6
         + coalesce(s9_mu,25) * p_s9 + coalesce(d9_mu,25) * p_d9)
          / (p_s6 + p_d6 + p_s9 + p_d9)
        - 3.0 * sqrt(1.0 / (p_s6 + p_d6 + p_s9 + p_d9))
      )::numeric(10,4)
  end
  from prec
$$;

-- ────────────────────────────────────────────────────────────
-- Recrear vista profile_ratings con la nueva fórmula en
-- global_mu y global_sigma (consistentes con global_ordinal).
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
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4) as d6_singles_ordinal,
  public.to_display_rating(c.singles_mu - 3 * c.singles_sigma)  as d6_singles_display,

  -- Doubles 6-6
  c.doubles_mu     as d6_doubles_mu,
  c.doubles_sigma  as d6_doubles_sigma,
  c.doubles_games  as d6_doubles_games,
  c.doubles_wins   as d6_doubles_wins,
  c.doubles_losses as d6_doubles_losses,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4) as d6_doubles_ordinal,
  public.to_display_rating(c.doubles_mu - 3 * c.doubles_sigma) as d6_doubles_display,

  -- Singles 9-9
  c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
  c.d9_singles_wins, c.d9_singles_losses,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4) as d9_singles_ordinal,
  public.to_display_rating(c.d9_singles_mu - 3 * c.d9_singles_sigma) as d9_singles_display,

  -- Doubles 9-9
  c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games,
  c.d9_doubles_wins, c.d9_doubles_losses,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4) as d9_doubles_ordinal,
  public.to_display_rating(c.d9_doubles_mu - 3 * c.d9_doubles_sigma) as d9_doubles_display,

  -- DomiRank Global: fusión Bayesiana SOLO de buckets jugados.
  -- Edge case (sin partidas): defaults μ=25, σ=8.33 — total_games < 5
  -- filtra al jugador del leaderboard global igualmente.
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

  (c.singles_games + c.doubles_games + c.d9_singles_games + c.d9_doubles_games) as total_games
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
