-- ============================================================
-- DomiRank · migración 0010
-- Escala de rating visible al usuario: 1-20 (DomiRank Display).
--
-- to_display_rating(ordinal) mapea ordinal OpenSkill (~0-50) a 1-20.
--   Anclas: ordinal 0 → 1.0 · ordinal 35 → 20.0
--   raw = 1 + (ordinal / 35) * 19   →   clamped [1, 20]   →   round a 1 decimal
--
-- La vista profile_ratings se recrea agregando columnas *_display
-- y global_display para que el frontend nunca compute la escala.
-- ============================================================

create or replace function public.to_display_rating(ordinal numeric)
returns numeric language sql immutable as $$
  select greatest(1.0, least(20.0, round((1.0 + (ordinal / 35.0) * 19.0) * 10) / 10.0))
$$;

-- ============================================================
-- Vista profile_ratings con columnas *_display
-- ============================================================
drop view if exists public.profile_ratings cascade;

create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    1.0 / (p.singles_sigma * p.singles_sigma)    as p_s6,
    1.0 / (p.doubles_sigma * p.doubles_sigma)    as p_d6,
    1.0 / (p.d9_singles_sigma * p.d9_singles_sigma) as p_s9,
    1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.onboarded,
  c.created_at, c.updated_at,

  -- Singles 6-6 (Venezolano / Dominicano / Puertorriqueño)
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

  -- Singles 9-9 (Cubano singles)
  c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
  c.d9_singles_wins, c.d9_singles_losses,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4) as d9_singles_ordinal,
  public.to_display_rating(c.d9_singles_mu - 3 * c.d9_singles_sigma) as d9_singles_display,

  -- Doubles 9-9 (Cubano parejas)
  c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games,
  c.d9_doubles_wins, c.d9_doubles_losses,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4) as d9_doubles_ordinal,
  public.to_display_rating(c.d9_doubles_mu - 3 * c.d9_doubles_sigma) as d9_doubles_display,

  -- DomiRank Global (fusión Bayesiana inverse-variance de los 4 buckets)
  (
    (c.singles_mu * c.p_s6 + c.doubles_mu * c.p_d6
     + c.d9_singles_mu * c.p_s9 + c.d9_doubles_mu * c.p_d9)
    / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9)
  )::numeric(10,4) as global_mu,
  sqrt(1.0 / (c.p_s6 + c.p_d6 + c.p_s9 + c.p_d9))::numeric(10,4) as global_sigma,
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
