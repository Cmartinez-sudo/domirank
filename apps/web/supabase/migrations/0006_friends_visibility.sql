-- ============================================================
-- DomiRank · migración 0006
-- - Sistema de amigos (friend_requests + friendships)
-- - Visibilidad de pollas (public / private / friends)
-- - Search rápido de usuarios por username/display_name
-- ============================================================

create extension if not exists pg_trgm;

-- ============================================================
-- FRIEND_REQUESTS: invitaciones pendientes
-- ============================================================
create table if not exists public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  from_user     uuid not null references auth.users(id) on delete cascade,
  to_user       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','accepted','rejected','cancelled')),
  message       text,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (from_user <> to_user),
  unique (from_user, to_user)
);

create index if not exists friend_requests_to_status_idx
  on public.friend_requests (to_user, status);
create index if not exists friend_requests_from_status_idx
  on public.friend_requests (from_user, status);

-- ============================================================
-- FRIENDSHIPS: relación simétrica una vez aceptada.
-- Se guardan AMBAS direcciones para queries simples por user_id.
-- ============================================================
create table if not exists public.friendships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  friend_id   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friendships_friend_idx on public.friendships (friend_id);

-- Helper: son amigos?
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.friendships where user_id = a and friend_id = b)
$$;

-- ============================================================
-- RLS amigos
-- ============================================================
alter table public.friend_requests enable row level security;
alter table public.friendships     enable row level security;

drop policy if exists fr_read_involved on public.friend_requests;
drop policy if exists fr_insert_from   on public.friend_requests;
drop policy if exists fr_update_to     on public.friend_requests;
drop policy if exists fr_update_from   on public.friend_requests;
create policy fr_read_involved on public.friend_requests for select using (auth.uid() = from_user or auth.uid() = to_user);
create policy fr_insert_from   on public.friend_requests for insert with check (auth.uid() = from_user);
-- El receptor puede aceptar/rechazar (status -> accepted/rejected)
create policy fr_update_to     on public.friend_requests for update using (auth.uid() = to_user);
-- El emisor puede cancelar (status -> cancelled)
create policy fr_update_from   on public.friend_requests for update using (auth.uid() = from_user);

drop policy if exists friendships_read_self on public.friendships;
drop policy if exists friendships_delete    on public.friendships;
create policy friendships_read_self on public.friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);
-- Solo via función security definer (insertan ambas direcciones); no insert directo.
create policy friendships_delete on public.friendships for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- ============================================================
-- Función security definer: aceptar friend_request.
-- Inserta ambas filas en friendships + marca el request como accepted.
-- Solo el destinatario del request puede ejecutarla.
-- ============================================================
create or replace function public.accept_friend_request(req_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  rec record;
begin
  select * into rec from public.friend_requests where id = req_id;
  if rec is null then raise exception 'request_not_found'; end if;
  if rec.to_user <> auth.uid() then raise exception 'not_allowed'; end if;
  if rec.status <> 'pending' then raise exception 'not_pending'; end if;

  insert into public.friendships (user_id, friend_id)
    values (rec.from_user, rec.to_user),
           (rec.to_user, rec.from_user)
    on conflict do nothing;

  update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = req_id;
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- Remover amistad: borra ambas direcciones
create or replace function public.unfriend(other_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if other_user is null or other_user = auth.uid() then return; end if;
  delete from public.friendships
    where (user_id = auth.uid() and friend_id = other_user)
       or (user_id = other_user and friend_id = auth.uid());
end;
$$;
revoke all on function public.unfriend(uuid) from public;
grant execute on function public.unfriend(uuid) to authenticated;

-- ============================================================
-- TOURNAMENTS · visibilidad (public / private / friends)
-- ============================================================
alter table public.tournaments
  add column if not exists visibility text not null default 'private'
    check (visibility in ('public','private','friends'));

create index if not exists tournaments_visibility_idx on public.tournaments (visibility);

-- Reescribir policy de lectura: ya NO es público para todos
drop policy if exists tournaments_read_all on public.tournaments;
create policy tournaments_read_visible on public.tournaments for select using (
  visibility = 'public'
  or created_by = auth.uid()
  or exists (
    select 1 from public.tournament_players tp
    where tp.tournament_id = id and tp.user_id = auth.uid()
  )
  or (
    visibility = 'friends' and exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = created_by
    )
  )
);

-- ============================================================
-- Search rápido en profiles (username y display_name)
-- ============================================================
create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

-- Función helper para buscar (case-insensitive, prefijo o substring)
create or replace function public.search_users(q text, lim int default 10, exclude_self boolean default true)
returns table (
  id uuid, username citext, display_name text, avatar_url text, country text
)
language sql stable as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.country
  from public.profiles p
  where (q is null or q = '' or p.username ilike q || '%' or p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')
    and (not exclude_self or p.id <> auth.uid())
  order by
    -- Prefijo en username > substring en username > display_name
    case when p.username ilike q || '%' then 0
         when p.username ilike '%' || q || '%' then 1
         else 2 end,
    p.username
  limit lim
$$;

grant execute on function public.search_users(text, int, boolean) to authenticated;
