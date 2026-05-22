-- ============================================================
-- DomiRank · migración 0022
-- Soporte de email para eventos de attestation:
--   1. Extiende get_user_email para incluir el scope de "coparticipantes
--      en un match". Epic Q removió el gating de amistad para jugar
--      partidas, así que dos jugadores pueden estar en el mismo match
--      sin ser amigos. Usado por finalizeMatch y attestMatch (auth
--      context del jugador caller).
--   2. Crea get_match_player_emails(p_match_id) para los paths que NO
--      tienen un coparticipante como caller: admin (resolviendo disputas
--      sobre matches en los que no juega) y cron auto-confirm (service
--      role, sin auth.uid). Grant solo a service_role.
--
-- Ambas funciones respetan profiles.email_notifications.
-- ============================================================

create or replace function public.get_user_email(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller   uuid;
  v_allowed  boolean;
  v_email    text;
  v_optin    boolean;
begin
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'not_authenticated';
  end if;

  -- Permitido si: es uno mismo, ya son amigos, friend_request pendiente,
  -- o ambos son jugadores del mismo match.
  select exists (
    select 1 where p_user_id = v_caller
    union all
    select 1 from public.friendships
      where user_id = v_caller and friend_id = p_user_id
    union all
    select 1 from public.friend_requests
      where (from_user = v_caller and to_user = p_user_id)
         or (from_user = p_user_id and to_user = v_caller)
    union all
    select 1
      from public.match_players mp1
      join public.match_players mp2 on mp1.match_id = mp2.match_id
      where mp1.user_id = v_caller and mp2.user_id = p_user_id
  ) into v_allowed;

  if not v_allowed then
    raise exception 'not_authorized';
  end if;

  -- Respeta preferencia del receptor: si tiene notificaciones desactivadas
  -- devolvemos NULL, así el caller naturalmente skipea el envío.
  select email_notifications into v_optin
  from public.profiles where id = p_user_id;
  if not coalesce(v_optin, true) then
    return null;
  end if;

  select email into v_email from auth.users where id = p_user_id;
  return v_email;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- get_match_player_emails: devuelve filas {user_id, email} de
-- jugadores opted-in para un match. Sin auth check porque está
-- restringido a service_role (cron + admin paths que usan service
-- client). Respeta email_notifications.
-- ────────────────────────────────────────────────────────────
create or replace function public.get_match_player_emails(p_match_id uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
  select mp.user_id, u.email::text
    from public.match_players mp
    join auth.users u    on u.id = mp.user_id
    join public.profiles p on p.id = mp.user_id
   where mp.match_id = p_match_id
     and coalesce(p.email_notifications, true)
     and u.email is not null;
end;
$$;

revoke all on function public.get_match_player_emails(uuid) from public;
grant execute on function public.get_match_player_emails(uuid) to service_role;

-- ────────────────────────────────────────────────────────────
-- auto_confirm_stale_matches ahora retorna SETOF uuid (los IDs
-- de los matches recién auto-confirmados) en vez de int. Permite
-- al cron enviar emails solo a los nuevos, no a los orphans que
-- ya fueron notificados por attestMatch en su momento.
--
-- Es safe romper el contrato: solo el cron consume esta RPC.
-- Drop primero porque PostgreSQL no permite cambiar el return type
-- con CREATE OR REPLACE.
-- ────────────────────────────────────────────────────────────
drop function if exists public.auto_confirm_stale_matches();

create or replace function public.auto_confirm_stale_matches()
returns setof uuid
language plpgsql security definer set search_path = public
as $$
declare
  m record;
begin
  for m in
    select id from public.matches
     where status = 'pending_attestation'
       and finalized_at < now() - interval '7 days'
       and (
         select count(*) from public.match_attestations a
         where a.match_id = matches.id and a.action = 'dispute'
       ) < 2
  loop
    perform set_config('app.skip_resolved_notification', 'true', true);

    update public.matches
       set status = 'confirmed', confirmed_at = now()
     where id = m.id;

    perform set_config('app.skip_resolved_notification', 'false', true);

    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id, 'match_auto_confirmed', m.id, '{}'::jsonb
    from public.match_players mp
    where mp.match_id = m.id;

    return next m.id;
  end loop;
  return;
end;
$$;

grant execute on function public.auto_confirm_stale_matches() to service_role;
grant execute on function public.auto_confirm_stale_matches() to authenticated;
