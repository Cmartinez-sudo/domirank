-- ============================================================
-- 0028 — Tournament Notifications (R3)
-- ============================================================
-- Idempotente: usa IF NOT EXISTS, DROP IF EXISTS, OR REPLACE.
-- Requisitos previos: 0027_tournament_pairs_wizard.sql ya aplicado.

-- ─── 1. Columnas nuevas en notifications ────────────────────

alter table public.notifications
  add column if not exists ref_tournament_id uuid
    references public.tournaments(id) on delete cascade;

-- ref_user_id: necesario para pair_invite_received (referencia al inviter)
alter table public.notifications
  add column if not exists ref_user_id uuid
    references auth.users(id) on delete cascade;

-- ─── 2. Expandir CHECK constraint de types ──────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'friend_request_received',
    'friend_request_accepted',
    'attest_requested',
    'attest_action',
    'match_confirmed',
    'match_disputed',
    'match_auto_confirmed',
    'tournament_added',
    'tournament_started',
    'tournament_round_ready',
    'tournament_match_ready',
    'tournament_finished',
    'pair_invite_received',
    'pair_invite_accepted'
  ));

-- ─── 3. Trigger: INSERT en tournament_players → notif al jugador ────

create or replace function public.notify_tournament_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_name text;
  v_is_organizer    boolean;
begin
  select created_by = new.user_id, name
  into v_is_organizer, v_tournament_name
  from public.tournaments
  where id = new.tournament_id;

  -- El organizador no se notifica a sí mismo
  if v_is_organizer then
    return new;
  end if;

  insert into public.notifications (user_id, type, ref_tournament_id, payload)
  values (
    new.user_id,
    'tournament_added',
    new.tournament_id,
    jsonb_build_object('tournament_name', v_tournament_name)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_tournament_added on public.tournament_players;
create trigger trg_notify_tournament_added
  after insert on public.tournament_players
  for each row execute function public.notify_tournament_added();

-- ─── 4. Trigger: INSERT en pair_invites (pending) → notif al invitee ───

create or replace function public.notify_pair_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_name text;
  v_inviter_name    text;
begin
  -- Solo disparar para invitaciones nuevas en estado 'pending'
  if new.status <> 'pending' then
    return new;
  end if;

  select t.name into v_tournament_name
  from public.tournaments t
  where t.id = new.tournament_id;

  select coalesce(display_name, username) into v_inviter_name
  from public.profiles
  where id = new.inviter_id;

  insert into public.notifications (user_id, type, ref_tournament_id, ref_user_id, payload)
  values (
    new.invitee_id,
    'pair_invite_received',
    new.tournament_id,
    new.inviter_id,
    jsonb_build_object(
      'tournament_name', v_tournament_name,
      'inviter_name',    v_inviter_name,
      'invite_id',       new.id::text
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_pair_invite on public.pair_invites;
create trigger trg_notify_pair_invite
  after insert on public.pair_invites
  for each row execute function public.notify_pair_invite();

-- ─── 5. Trigger: tournaments status → 'in_progress' → notif a participantes ──

create or replace function public.notify_tournament_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando la transición es hacia 'in_progress'
  if old.status = new.status then
    return new;
  end if;
  if new.status <> 'in_progress' then
    return new;
  end if;

  insert into public.notifications (user_id, type, ref_tournament_id, payload)
  select
    tp.user_id,
    'tournament_started',
    new.id,
    jsonb_build_object('tournament_name', new.name)
  from public.tournament_players tp
  where tp.tournament_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_notify_tournament_started on public.tournaments;
create trigger trg_notify_tournament_started
  after update of status on public.tournaments
  for each row execute function public.notify_tournament_started();

-- ─── 6. RPC: torneos pendientes del usuario (para el popup) ─────────────────
-- Devuelve torneos activos en los que el usuario participa, junto con
-- información sobre si tiene una partida pendiente en la ronda actual.

create or replace function public.get_user_pending_tournaments(p_user_id uuid)
returns table (
  id              uuid,
  name            text,
  status          text,
  has_pending_match boolean,
  next_match_id   uuid
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.status,
    exists (
      select 1 from public.tournament_pairings tp
      where tp.tournament_id = t.id
        and (
          tp.match_id is null
          or exists (
            select 1 from public.matches m
            where m.id = tp.match_id
              and m.status in ('in_progress', 'pending_attestation')
          )
        )
        and (
          p_user_id = any(tp.team_a_user_ids)
          or p_user_id = any(tp.team_b_user_ids)
        )
    ) as has_pending_match,
    (
      select tp2.match_id
      from public.tournament_pairings tp2
      where tp2.tournament_id = t.id
        and (
          p_user_id = any(tp2.team_a_user_ids)
          or p_user_id = any(tp2.team_b_user_ids)
        )
        and tp2.match_id is not null
      order by tp2.round desc
      limit 1
    ) as next_match_id
  from public.tournaments t
  join public.tournament_players tpl on tpl.tournament_id = t.id
  where tpl.user_id = p_user_id
    and t.status in ('open', 'in_progress');
$$;

grant execute on function public.get_user_pending_tournaments(uuid) to authenticated;

-- ============================================================
-- PASOS MANUALES POST-MIGRACIÓN
-- Aplicar en Supabase SQL Editor o via CLI:
--   supabase db push
--
-- Verificar con:
--   select column_name from information_schema.columns
--   where table_name = 'notifications' and table_schema = 'public'
--   order by ordinal_position;
--
--   select routine_name from information_schema.routines
--   where routine_schema = 'public'
--   and routine_name in (
--     'notify_tournament_added',
--     'notify_pair_invite',
--     'notify_tournament_started',
--     'get_user_pending_tournaments'
--   );
-- ============================================================
