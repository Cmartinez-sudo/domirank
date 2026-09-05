-- ============================================================
-- Domino Ranking · esquema inicial
-- Modelo: OpenSkill (Plackett-Luce con aproximaciones Weng-Lin)
-- Postgres 15+ / Supabase
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================
-- PROFILES: extiende auth.users con identidad pública y ratings
-- Defaults OpenSkill: mu = 25.0, sigma = 25/3 ≈ 8.3333
-- ============================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        citext unique not null,
  display_name    text,
  avatar_url      text,
  bio             text,
  country         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Rating singles (1v1)
  singles_mu      numeric(10,4) not null default 25.0000,
  singles_sigma   numeric(10,4) not null default 8.3333,
  singles_games   integer       not null default 0,
  singles_wins    integer       not null default 0,
  singles_losses  integer       not null default 0,

  -- Rating doubles (2v2)
  doubles_mu      numeric(10,4) not null default 25.0000,
  doubles_sigma   numeric(10,4) not null default 8.3333,
  doubles_games   integer       not null default 0,
  doubles_wins    integer       not null default 0,
  doubles_losses  integer       not null default 0,

  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,24}$')
);

-- Rating "ordinal" derivado (mu - 3*sigma) — conservador, igual que TrueSkill
create or replace view public.profile_ratings as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.singles_mu, p.singles_sigma, p.singles_games, p.singles_wins, p.singles_losses,
  (p.singles_mu - 3 * p.singles_sigma)::numeric(10,4) as singles_ordinal,
  p.doubles_mu, p.doubles_sigma, p.doubles_games, p.doubles_wins, p.doubles_losses,
  (p.doubles_mu - 3 * p.doubles_sigma)::numeric(10,4) as doubles_ordinal
from public.profiles p;

create index if not exists profiles_singles_ordinal_idx
  on public.profiles (((singles_mu - 3 * singles_sigma)) desc);
create index if not exists profiles_doubles_ordinal_idx
  on public.profiles (((doubles_mu - 3 * doubles_sigma)) desc);

-- ============================================================
-- MATCHES: una partida (singles o doubles)
-- Se considera "rated" si al guardarse se aplicó OpenSkill.
-- ============================================================
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  format          text not null check (format in ('singles','doubles')),
  target_points   integer not null default 100 check (target_points between 50 and 500),
  status          text not null default 'completed'
                  check (status in ('completed','in_progress','cancelled')),
  notes           text,
  rated           boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists matches_created_at_idx on public.matches (created_at desc);
create index if not exists matches_format_idx     on public.matches (format);

-- ============================================================
-- MATCH_PLAYERS: filas por jugador, con team, score y rank final.
-- Snapshot del rating antes/después permite reconstruir historial.
-- ============================================================
create table if not exists public.match_players (
  id              bigserial primary key,
  match_id        uuid not null references public.matches(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete restrict,
  team            integer not null check (team between 1 and 8),
  score           integer not null default 0 check (score >= 0),
  rank            integer check (rank >= 1),  -- 1 = ganador

  mu_before       numeric(10,4),
  sigma_before    numeric(10,4),
  mu_after        numeric(10,4),
  sigma_after     numeric(10,4),

  created_at      timestamptz not null default now(),

  unique (match_id, user_id)
);

create index if not exists match_players_match_idx on public.match_players (match_id);
create index if not exists match_players_user_idx  on public.match_players (user_id, created_at desc);

-- ============================================================
-- Trigger: al crear un auth.user, crear su profile automáticamente.
-- El username inicial se deriva del email y se puede cambiar después.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base_username) < 3 then
    base_username := 'player' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_username := substring(base_username from 1 for 20);
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := substring(base_username from 1 for 20) || counter::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, coalesce(new.raw_user_meta_data->>'display_name', final_username));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Trigger: mantener updated_at en profiles
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.matches        enable row level security;
alter table public.match_players  enable row level security;

-- Profiles: todos pueden leer, cada usuario solo edita el propio.
drop policy if exists profiles_read_all     on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_insert_own   on public.profiles;
create policy profiles_read_all   on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

-- Matches: lectura pública; insert/update solo autenticados.
-- (En MVP cualquier usuario autenticado puede registrar una partida en la
-- que participa. En v2 se podrá restringir a partidas con árbitro/firma.)
drop policy if exists matches_read_all      on public.matches;
drop policy if exists matches_insert_auth   on public.matches;
drop policy if exists matches_update_creator on public.matches;
create policy matches_read_all     on public.matches for select using (true);
create policy matches_insert_auth  on public.matches for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy matches_update_creator on public.matches for update using (created_by = auth.uid());

-- Match_players: lectura pública; insert por el creador de la partida.
drop policy if exists match_players_read_all     on public.match_players;
drop policy if exists match_players_insert_owner on public.match_players;
create policy match_players_read_all on public.match_players for select using (true);
create policy match_players_insert_owner on public.match_players for insert with check (
  exists (select 1 from public.matches m where m.id = match_id and m.created_by = auth.uid())
);

-- ============================================================
-- Vista para el feed de partidas (con nombres y scores ya juntos)
-- ============================================================
create or replace view public.match_feed as
select
  m.id,
  m.format,
  m.target_points,
  m.status,
  m.created_at,
  m.finished_at,
  m.created_by,
  jsonb_agg(
    jsonb_build_object(
      'user_id',  mp.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'team',     mp.team,
      'score',    mp.score,
      'rank',     mp.rank,
      'mu_before',  mp.mu_before,
      'sigma_before', mp.sigma_before,
      'mu_after',   mp.mu_after,
      'sigma_after', mp.sigma_after
    )
    order by mp.team, mp.user_id
  ) as players
from public.matches m
left join public.match_players mp on mp.match_id = m.id
left join public.profiles p on p.id = mp.user_id
group by m.id;

grant select on public.profile_ratings to anon, authenticated;
grant select on public.match_feed      to anon, authenticated;
