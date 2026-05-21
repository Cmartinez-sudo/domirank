-- ============================================================
-- DomiRank · migración 0018 — hardening del attestation flow
--
-- Fixes del code review (architect):
--
-- 1. auto_confirm_stale_matches filtraba mal: usaba "NOT EXISTS dispute",
--    pero la regla es "2+ disputas bloquean". Una sola disputa + silencio
--    debería auto-confirmar. Ahora usa count(disputes) < 2.
--
-- 2. notify_match_resolved decidía "auto_confirmed" por edad del match,
--    pero un admin resolviendo un match viejo enviaba tipo equivocado.
--    Ahora solo envía 'match_confirmed'/'match_disputed'. El cron
--    auto-confirm envía 'match_auto_confirmed' directamente (parte 3).
--
-- 3. auto_confirm_stale_matches ahora inserta notifications directly
--    para el tipo 'match_auto_confirmed' (evita el trigger).
--
-- 4. attest_match rechaza explícitamente si el match no está en
--    pending_attestation, en vez de silenciosamente insertar attestation
--    huérfana y spammear notificaciones.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. notify_match_resolved: simplificada (sin age check)
-- ────────────────────────────────────────────────────────────
create or replace function public.notify_match_resolved()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending_attestation' and new.status in ('confirmed', 'disputed') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id,
           case when new.status = 'confirmed' then 'match_confirmed'
                else 'match_disputed' end,
           new.id, '{}'::jsonb
    from public.match_players mp
    where mp.match_id = new.id;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. auto_confirm_stale_matches: filtro correcto + notifs directas
-- ────────────────────────────────────────────────────────────
create or replace function public.auto_confirm_stale_matches()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
  m record;
begin
  -- Pendientes con menos de 2 disputas tras 7 días → auto-confirm
  for m in
    select id from public.matches
     where status = 'pending_attestation'
       and finalized_at < now() - interval '7 days'
       and (
         select count(*) from public.match_attestations a
         where a.match_id = matches.id and a.action = 'dispute'
       ) < 2
  loop
    -- Cambiamos status sin disparar notify_match_resolved del tipo equivocado.
    -- En vez, insertamos directly el tipo 'match_auto_confirmed'.
    -- (notify_match_resolved enviará 'match_confirmed' como side effect, pero
    -- lo prevenimos con un flag de sesión.)
    perform set_config('app.skip_resolved_notification', 'true', true);

    update public.matches
       set status = 'confirmed', confirmed_at = now()
     where id = m.id;

    perform set_config('app.skip_resolved_notification', 'false', true);

    -- Notif explícita de auto-confirm
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id, 'match_auto_confirmed', m.id, '{}'::jsonb
    from public.match_players mp
    where mp.match_id = m.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Hacer que notify_match_resolved respete el flag de sesión del cron
create or replace function public.notify_match_resolved()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Skip si el cron auto-confirm está poniendo esa transición (él envía su
  -- propia notif 'match_auto_confirmed').
  if current_setting('app.skip_resolved_notification', true) = 'true' then
    return new;
  end if;

  if old.status = 'pending_attestation' and new.status in ('confirmed', 'disputed') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id,
           case when new.status = 'confirmed' then 'match_confirmed'
                else 'match_disputed' end,
           new.id, '{}'::jsonb
    from public.match_players mp
    where mp.match_id = new.id;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. attest_match: rechaza explícitamente si no es pending
-- ────────────────────────────────────────────────────────────
create or replace function public.attest_match(
  p_match_id uuid,
  p_action   text,
  p_comment  text default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_status     text;
  v_new_status text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_action not in ('confirm','dispute') then raise exception 'invalid_action'; end if;

  if not exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = v_user
  ) then
    raise exception 'not_a_participant';
  end if;

  -- NUEVO: rechazar si el match ya no admite attestations
  select status into v_status from public.matches where id = p_match_id;
  if v_status is null then raise exception 'match_not_found'; end if;
  if v_status <> 'pending_attestation' then
    raise exception 'not_pending_attestation';
  end if;

  insert into public.match_attestations (match_id, user_id, action, comment)
  values (p_match_id, v_user, p_action, p_comment)
  on conflict (match_id, user_id) do update set
    action     = excluded.action,
    comment    = excluded.comment,
    created_at = now();

  v_new_status := public.evaluate_match_quorum(p_match_id);
  return v_new_status;
end;
$$;
