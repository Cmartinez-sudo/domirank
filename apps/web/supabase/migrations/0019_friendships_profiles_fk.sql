-- ============================================================
-- DomiRank · migración 0019
-- Bug fix: friendships y friend_requests necesitan FKs a
-- public.profiles (no solo a auth.users) para que PostgREST
-- pueda resolver los embedded joins usados en /friends/page.tsx.
--
-- Root cause:
--   page.tsx usaba:
--     .select("friend:profiles!friendships_friend_id_fkey(...)")
--   Pero friendships_friend_id_fkey apunta a auth.users, no a
--   public.profiles. PostgREST no podía resolver el join y
--   devolvía null para cada fila. filter(Boolean) en el mapper
--   descartaba todos → lista vacía aunque existieran friendships.
--
-- Fix:
--   Añadir FKs explícitas a public.profiles con nombres nuevos.
--   El código TypeScript usa esos nombres en los hints PostgREST.
-- ============================================================

-- friendships → profiles
alter table public.friendships
  add constraint friendships_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.friendships
  add constraint friendships_friend_id_profiles_fkey
    foreign key (friend_id) references public.profiles(id) on delete cascade;

-- friend_requests → profiles
alter table public.friend_requests
  add constraint friend_requests_from_user_profiles_fkey
    foreign key (from_user) references public.profiles(id) on delete cascade;

alter table public.friend_requests
  add constraint friend_requests_to_user_profiles_fkey
    foreign key (to_user) references public.profiles(id) on delete cascade;
