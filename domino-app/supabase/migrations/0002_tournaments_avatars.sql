-- ============================================================
-- DomiRank · migración 0002
-- - Pollas (tournaments) con sistema de rotación abierto
-- - Bucket de avatars en Supabase Storage
-- - FK tournament_id en matches (ya pre-existente al esquema base)
-- ============================================================

-- ============================================================
-- TOURNAMENTS (Pollas)
-- Sistema de rotación: cada partida se eligen 4 jugadores de la polla,
-- se sortean / asignan parejas y se juega. Standings derivados de las
-- partidas con tournament_id = polla.id.
-- ============================================================
create table if not exists public.tournaments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  points_to_win   integer not null default 100 check (points_to_win between 50 and 500),
  rounds          integer not null default 0  check (rounds between 0 and 200),  -- 0 = sin límite
  continuous      boolean not null default false,
  rated           boolean not null default true,
  status          text not null default 'active'
                  check (status in ('active','finished','archived')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,
  session_started_at timestamptz   -- para modo continuo
);

create index if not exists tournaments_status_idx on public.tournaments (status, created_at desc);
create index if not exists tournaments_creator_idx on public.tournaments (created_by);

-- Jugadores inscritos en cada polla
create table if not exists public.tournament_players (
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  user_id         uuid not null references public.profiles(id)    on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create index if not exists tournament_players_user_idx on public.tournament_players (user_id);

-- Añadir FK tournament_id en matches (si no existe)
alter table public.matches
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null;

create index if not exists matches_tournament_idx on public.matches (tournament_id);

-- ============================================================
-- RLS para pollas
-- ============================================================
alter table public.tournaments         enable row level security;
alter table public.tournament_players  enable row level security;

drop policy if exists tournaments_read_all       on public.tournaments;
drop policy if exists tournaments_insert_auth    on public.tournaments;
drop policy if exists tournaments_update_creator on public.tournaments;
create policy tournaments_read_all       on public.tournaments for select using (true);
create policy tournaments_insert_auth    on public.tournaments for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy tournaments_update_creator on public.tournaments for update using (created_by = auth.uid());

drop policy if exists tp_read_all          on public.tournament_players;
drop policy if exists tp_insert_creator    on public.tournament_players;
drop policy if exists tp_delete_creator    on public.tournament_players;
create policy tp_read_all       on public.tournament_players for select using (true);
create policy tp_insert_creator on public.tournament_players for insert with check (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.created_by = auth.uid())
);
create policy tp_delete_creator on public.tournament_players for delete using (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.created_by = auth.uid())
);

-- ============================================================
-- Vista: standings de una polla
-- Calcula wins, losses, games, points_for, points_against y racha
-- desde las partidas que referencian la polla.
-- ============================================================
create or replace view public.tournament_standings as
with base as (
  select
    t.id  as tournament_id,
    tp.user_id,
    p.username,
    p.display_name,
    p.avatar_url
  from public.tournaments t
  join public.tournament_players tp on tp.tournament_id = t.id
  join public.profiles p on p.id = tp.user_id
),
stats as (
  select
    m.tournament_id,
    mp.user_id,
    count(*)                                             as games,
    sum(case when mp.rank = 1 then 1 else 0 end)         as wins,
    sum(case when mp.rank <> 1 then 1 else 0 end)        as losses,
    sum(mp.score)                                        as points_for,
    sum(opp.opp_score)                                   as points_against
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  -- score del equipo rival en la misma partida
  join lateral (
    select coalesce(sum(mp2.score) filter (where mp2.team <> mp.team), 0) as opp_score
    from public.match_players mp2 where mp2.match_id = m.id
  ) opp on true
  where m.tournament_id is not null and m.status = 'completed'
  group by m.tournament_id, mp.user_id
)
select
  b.tournament_id,
  b.user_id,
  b.username,
  b.display_name,
  b.avatar_url,
  coalesce(s.games, 0)          as games,
  coalesce(s.wins, 0)           as wins,
  coalesce(s.losses, 0)         as losses,
  coalesce(s.points_for, 0)     as points_for,
  coalesce(s.points_against, 0) as points_against,
  case when coalesce(s.games,0) = 0 then 0
       else round(s.wins::numeric / s.games * 100, 1) end as win_pct
from base b
left join stats s on s.tournament_id = b.tournament_id and s.user_id = b.user_id;

grant select on public.tournament_standings to anon, authenticated;

-- ============================================================
-- AVATARS · Supabase Storage
-- Crear bucket 'avatars' público y políticas RLS
-- (En la UI de Supabase: Storage → New bucket "avatars" → Public)
-- Si prefieres script, descomenta:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
--   on conflict (id) do nothing;

-- Policies: cualquier usuario autenticado puede subir SU propio avatar.
-- Estructura recomendada: path = auth.uid() || '/' || filename
drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
