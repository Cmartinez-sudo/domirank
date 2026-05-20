-- ============================================================
-- DomiRank · migración 0013
-- Extiende búsqueda de usuarios con ratings, añade búsqueda de
-- amigos, y helper para validar amistad.
--
-- Motivación:
--   - K1: matches/torneos solo se pueden crear con amigos →
--     necesitamos search_friends + are_friends (validación server).
--   - J1: cualquier UserSearch debe mostrar el rating del usuario →
--     extendemos search_users con global_display y total_games.
-- ============================================================

-- ── search_users: ahora incluye rating ─────────────────────────
drop function if exists public.search_users(text, int, boolean);

create or replace function public.search_users(
  q text,
  lim int default 10,
  exclude_self boolean default true
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text,
  global_display numeric,
  total_games int
)
language sql stable as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    p.country,
    pr.global_display,
    pr.total_games::int
  from public.profiles p
  left join public.profile_ratings pr on pr.id = p.id
  where (q is null or q = '' or p.username ilike q || '%' or p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')
    and (not exclude_self or p.id <> auth.uid())
  order by
    case when p.username ilike q || '%' then 0
         when p.username ilike '%' || q || '%' then 1
         else 2 end,
    p.username
  limit lim
$$;

grant execute on function public.search_users(text, int, boolean) to authenticated;


-- ── search_friends: misma forma, pero solo amigos del caller ──
create or replace function public.search_friends(
  q text,
  lim int default 20
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text,
  global_display numeric,
  total_games int
)
language sql stable as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    p.country,
    pr.global_display,
    pr.total_games::int
  from public.profiles p
  inner join public.friendships f
    on f.friend_id = p.id and f.user_id = auth.uid()
  left join public.profile_ratings pr on pr.id = p.id
  where (
    q is null or q = ''
    or p.username ilike q || '%'
    or p.username ilike '%' || q || '%'
    or p.display_name ilike '%' || q || '%'
  )
  order by
    case
      when q is null or q = '' then 0
      when p.username ilike q || '%' then 0
      when p.username ilike '%' || q || '%' then 1
      else 2
    end,
    p.username
  limit lim
$$;

grant execute on function public.search_friends(text, int) to authenticated;

-- Nota: are_friends(a, b) ya existe desde migración 0006. La validación
-- server-side en startLiveMatch/createTournament usa queries directas sobre
-- friendships para batch-check de múltiples jugadores en una sola roundtrip.
