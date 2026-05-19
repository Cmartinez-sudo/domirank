-- ============================================================
-- DomiRank · migración 0003
-- DomiRank Global: combinación Bayesiana inverse-variance de singles y parejas.
--
-- Asume que singles_rating y doubles_rating son dos estimaciones independientes
-- del mismo "skill latente de dominó". La fusión correcta de dos gaussianas
-- N(μ_s, σ²_s) y N(μ_d, σ²_d) es:
--
--   μ_global = (μ_s/σ²_s + μ_d/σ²_d) / (1/σ²_s + 1/σ²_d)
--   σ²_global = 1 / (1/σ²_s + 1/σ²_d)
--
-- Ventaja clave: si un jugador nunca jugó un formato, su σ alta (default 8.33)
-- automáticamente hace que ese formato contribuya muy poco al global.
-- No requiere casos especiales.
-- ============================================================

create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    -- Precisiones (1/σ²) — Postgres maneja la división con tipo numeric
    (1.0 / (p.singles_sigma * p.singles_sigma)) as p_s,
    (1.0 / (p.doubles_sigma * p.doubles_sigma)) as p_d
  from public.profiles p
)
select
  c.id,
  c.username,
  c.display_name,
  c.avatar_url,
  c.created_at,
  c.updated_at,

  -- Singles
  c.singles_mu,
  c.singles_sigma,
  c.singles_games,
  c.singles_wins,
  c.singles_losses,
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4) as singles_ordinal,

  -- Doubles
  c.doubles_mu,
  c.doubles_sigma,
  c.doubles_games,
  c.doubles_wins,
  c.doubles_losses,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4) as doubles_ordinal,

  -- DomiRank Global (combinación Bayesiana inverse-variance)
  ((c.singles_mu * c.p_s + c.doubles_mu * c.p_d) / (c.p_s + c.p_d))::numeric(10,4) as global_mu,
  sqrt(1.0 / (c.p_s + c.p_d))::numeric(10,4)                                       as global_sigma,
  (
    ((c.singles_mu * c.p_s + c.doubles_mu * c.p_d) / (c.p_s + c.p_d))
    - 3.0 * sqrt(1.0 / (c.p_s + c.p_d))
  )::numeric(10,4) as global_ordinal,

  -- Helpers
  (c.singles_games + c.doubles_games) as total_games,
  -- Peso porcentual de cada formato en el global
  (c.p_s / (c.p_s + c.p_d) * 100)::numeric(5,2) as singles_weight_pct,
  (c.p_d / (c.p_s + c.p_d) * 100)::numeric(5,2) as doubles_weight_pct
from combined c;

-- Índice sobre global_ordinal para queries rápidas del leaderboard global.
-- Se recalcula vía función inmutable.
create or replace function public.calc_global_ordinal(s_mu numeric, s_sigma numeric, d_mu numeric, d_sigma numeric)
returns numeric language sql immutable as $$
  select (
    (s_mu / (s_sigma*s_sigma) + d_mu / (d_sigma*d_sigma)) / (1.0/(s_sigma*s_sigma) + 1.0/(d_sigma*d_sigma))
    - 3.0 * sqrt(1.0 / (1.0/(s_sigma*s_sigma) + 1.0/(d_sigma*d_sigma)))
  )::numeric(10,4)
$$;

drop index if exists profiles_global_ordinal_idx;
create index profiles_global_ordinal_idx on public.profiles
  ( public.calc_global_ordinal(singles_mu, singles_sigma, doubles_mu, doubles_sigma) desc );

grant select on public.profile_ratings to anon, authenticated;
