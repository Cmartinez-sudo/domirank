-- ============================================================
-- DomiRank · migración 0014
-- Soporte para notificaciones por email:
--   - Toggle email_notifications en profiles (default true)
--   - Función SECURITY DEFINER get_user_email(uuid) que solo
--     devuelve el correo de usuarios con los que el caller tiene
--     una relación (amistad o solicitud pendiente bi-direccional).
--     Esto previene enumeración de correos.
-- ============================================================

alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

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

  -- Permitido si: es uno mismo, ya son amigos, o existe friend_request
  -- pendiente entre ambos en cualquier dirección.
  select exists (
    select 1 where p_user_id = v_caller
    union all
    select 1 from public.friendships
      where user_id = v_caller and friend_id = p_user_id
    union all
    select 1 from public.friend_requests
      where (from_user = v_caller and to_user = p_user_id)
         or (from_user = p_user_id and to_user = v_caller)
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

grant execute on function public.get_user_email(uuid) to authenticated;
