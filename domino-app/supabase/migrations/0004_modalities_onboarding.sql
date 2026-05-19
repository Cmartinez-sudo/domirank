-- ============================================================
-- DomiRank · migración 0004
-- Modalidades de juego (Venezolano, Dominicano, Cubano, Puertorriqueño…),
-- soporte para set doble-nueve, onboarding (país + modalidad default),
-- y bonus capicúa por partida.
--
-- Decisión de diseño (basada en investigación de skill transfer):
--   - Modalidades con el MISMO set comparten rating (la estructura
--     estratégica es idéntica; solo cambian puntos meta y bonus).
--   - Sets distintos (6-6 vs 9-9) tienen ratings SEPARADOS porque
--     el espacio de acciones y la carga de memoria difieren.
--   - DomiRank Global combina los 4 buckets (singles/doubles × 6-6/9-9)
--     vía fusión bayesiana inverse-variance.
-- ============================================================

-- ============================================================
-- PROFILES: campos de onboarding (país + modalidad default)
-- ============================================================
alter table public.profiles
  add column if not exists country         text,
  add column if not exists default_modality text check (default_modality in ('ven','dom','cub','pri','custom')),
  add column if not exists onboarded       boolean not null default false;

-- ============================================================
-- PROFILES: rating bucket para set doble-nueve (cubano)
-- Las columnas existentes singles_* y doubles_* siguen representando
-- el rating de set doble-seis (Venezolano/Dominicano/Puertorriqueño).
-- ============================================================
alter table public.profiles
  add column if not exists d9_singles_mu     numeric(10,4) not null default 25.0000,
  add column if not exists d9_singles_sigma  numeric(10,4) not null default 8.3333,
  add column if not exists d9_singles_games  integer       not null default 0,
  add column if not exists d9_singles_wins   integer       not null default 0,
  add column if not exists d9_singles_losses integer       not null default 0,
  add column if not exists d9_doubles_mu     numeric(10,4) not null default 25.0000,
  add column if not exists d9_doubles_sigma  numeric(10,4) not null default 8.3333,
  add column if not exists d9_doubles_games  integer       not null default 0,
  add column if not exists d9_doubles_wins   integer       not null default 0,
  add column if not exists d9_doubles_losses integer       not null default 0;

-- ============================================================
-- MATCHES: modalidad + set + bonus capicúa
-- ============================================================
alter table public.matches
  add column if not exists modality     text check (modality in ('ven','dom','cub','pri','custom')),
  add column if not exists set_size     text not null default 'd6' check (set_size in ('d6','d9')),
  add column if not exists capicua_bonus integer not null default 30 check (capicua_bonus between 0 and 100);

create index if not exists matches_modality_idx on public.matches (modality);
create index if not exists matches_set_size_idx on public.matches (set_size);

-- ============================================================
-- TOURNAMENTS: modalidad
-- ============================================================
alter table public.tournaments
  add column if not exists modality text check (modality in ('ven','dom','cub','pri','custom'));

-- ============================================================
-- Función helper: DomiRank Global con 4 buckets
-- ============================================================
create or replace function public.calc_global_ordinal_v2(
  s6_mu numeric, s6_sigma numeric, s6_games int,
  d6_mu numeric, d6_sigma numeric, d6_games int,
  s9_mu numeric, s9_sigma numeric, s9_games int,
  d9_mu numeric, d9_sigma numeric, d9_games int
) returns numeric language sql immutable as $$
  with prec as (
    select
      1.0 / (s6_sigma * s6_sigma) as p_s6,
      1.0 / (d6_sigma * d6_sigma) as p_d6,
      1.0 / (s9_sigma * s9_sigma) as p_s9,
      1.0 / (d9_sigma * d9_sigma) as p_d9
  )
  select (
    (s6_mu * p_s6 + d6_mu * p_d6 + s9_mu * p_s9 + d9_mu * p_d9)
      / (p_s6 + p_d6 + p_s9 + p_d9)
    - 3.0 * sqrt(1.0 / (p_s6 + p_d6 + p_s9 + p_d9))
  )::numeric(10,4)
  from prec
$$;

-- ============================================================
-- Vista profile_ratings actualizada para 4 buckets
-- ============================================================
drop view if exists public.profile_ratings cascade;

create or replace view public.profile_ratings as
with combined as (
  select
    p.*,
    1.0 / (p.singles_sigma * p.singles_sigma) as p_s6,
    1.0 / (p.doubles_sigma * p.doubles_sigma) as p_d6,
    1.0 / (p.d9_singles_sigma * p.d9_singles_sigma) as p_s9,
    1.0 / (p.d9_doubles_sigma * p.d9_doubles_sigma) as p_d9
  from public.profiles p
)
select
  c.id, c.username, c.display_name, c.avatar_url,
  c.country, c.default_modality, c.onboarded,
  c.created_at, c.updated_at,

  -- Singles 6-6 (Venezolano/Dominicano/Puertorriqueño en singles)
  c.singles_mu    as d6_singles_mu,
  c.singles_sigma as d6_singles_sigma,
  c.singles_games as d6_singles_games,
  c.singles_wins  as d6_singles_wins,
  c.singles_losses as d6_singles_losses,
  (c.singles_mu - 3 * c.singles_sigma)::numeric(10,4) as d6_singles_ordinal,

  -- Doubles 6-6
  c.doubles_mu    as d6_doubles_mu,
  c.doubles_sigma as d6_doubles_sigma,
  c.doubles_games as d6_doubles_games,
  c.doubles_wins  as d6_doubles_wins,
  c.doubles_losses as d6_doubles_losses,
  (c.doubles_mu - 3 * c.doubles_sigma)::numeric(10,4) as d6_doubles_ordinal,

  -- Singles 9-9
  c.d9_singles_mu, c.d9_singles_sigma, c.d9_singles_games,
  c.d9_singles_wins, c.d9_singles_losses,
  (c.d9_singles_mu - 3 * c.d9_singles_sigma)::numeric(10,4) as d9_singles_ordinal,

  -- Doubles 9-9 (Cubano)
  c.d9_doubles_mu, c.d9_doubles_sigma, c.d9_doubles_games,
  c.d9_doubles_wins, c.d9_doubles_losses,
  (c.d9_doubles_mu - 3 * c.d9_doubles_sigma)::numeric(10,4) as d9_doubles_ordinal,

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

  (c.singles_games + c.doubles_games + c.d9_singles_games + c.d9_doubles_games) as total_games
from combined c;

grant select on public.profile_ratings to anon, authenticated;

-- ============================================================
-- Reemplazar el índice anterior por uno con los 4 buckets
-- ============================================================
drop index if exists profiles_global_ordinal_idx;
create index profiles_global_ordinal_idx on public.profiles (
  public.calc_global_ordinal_v2(
    singles_mu, singles_sigma, singles_games,
    doubles_mu, doubles_sigma, doubles_games,
    d9_singles_mu, d9_singles_sigma, d9_singles_games,
    d9_doubles_mu, d9_doubles_sigma, d9_doubles_games
  ) desc
);
