-- ============================================================
-- DomiRank · migración 0015
-- Habilita Supabase Realtime en friend_requests para que el cliente
-- reciba notificaciones instantáneas cuando alguien le manda solicitud.
--
-- Supabase Realtime respeta RLS automáticamente — solo se entrega un
-- evento si la SELECT policy permite ver la fila al subscriber.
-- friend_requests ya tiene SELECT policy "involved_users_only", por lo
-- que el cliente solo recibe eventos donde es from_user o to_user.
-- ============================================================

alter publication supabase_realtime add table public.friend_requests;
