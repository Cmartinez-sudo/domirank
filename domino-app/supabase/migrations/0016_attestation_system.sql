-- ============================================================
-- DomiRank · migración 0016 — Epic Q: Attestation System
-- Incluye también la tabla notifications de Epic O.2 ya que es base.
--
-- Cambio fundamental:
--   - Partidas finalizadas NO afectan rating hasta tener consenso.
--   - 3 de 4 jugadores firmando = confirmed → aplica rating.
--   - 2+ disputas = disputed → bloqueado, requiere admin.
--   - 7 días sin disputas = auto-confirm (cron job, ver función al final).
--   - Scorekeeper auto-firma al finalizar (cuenta como 1 confirm).
--
-- Estados de matches:
--   in_progress         → partida activa en vivo
--   pending_attestation → finalizada, esperando consensus
--   confirmed           → consensus alcanzado, rating aplicado
--   disputed            → 2+ disputas, bloqueada hasta admin resolve
--   void                → admin marcó como no contar, o creator anuló
--   cancelled           → usuario canceló antes de finalizar
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE 1 · TABLA NOTIFICATIONS + REALTIME (Epic O.2)
-- ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,
  ref_match_id uuid references public.matches(id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own   on public.notifications;
drop policy if exists notifications_update_own on public.notifications;

create policy notifications_read_own
  on public.notifications for select using (auth.uid() = user_id);

create policy notifications_update_own
  on public.notifications for update using (auth.uid() = user_id);

-- Type enum (los tipos legítimos)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications drop constraint notifications_type_check;
  end if;
  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'friend_request_received', 'friend_request_accepted',
      'attest_requested', 'attest_action',
      'match_confirmed', 'match_disputed', 'match_auto_confirmed'
    ));
end$$;

-- Habilitar Realtime (re-adicionar es idempotente con manejo de error)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end$$;

-- ────────────────────────────────────────────────────────────
-- PARTE 2 · TRIGGERS DE NOTIFICACIONES PARA FRIEND REQUESTS
-- ────────────────────────────────────────────────────────────

create or replace function public.on_friend_request_pending()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and new.status = 'pending')
     or (TG_OP = 'UPDATE' and new.status = 'pending' and old.status is distinct from 'pending') then
    insert into public.notifications (user_id, type, payload)
    values (
      new.to_user,
      'friend_request_received',
      jsonb_build_object('request_id', new.id, 'from_user', new.from_user)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists friend_requests_after_insert on public.friend_requests;
drop trigger if exists friend_requests_pending     on public.friend_requests;
create trigger friend_requests_pending
  after insert or update on public.friend_requests
  for each row execute function public.on_friend_request_pending();

create or replace function public.on_friend_request_accepted()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (
      new.from_user,
      'friend_request_accepted',
      jsonb_build_object('request_id', new.id, 'by_user', new.to_user)
    );
    update public.notifications
       set read_at = now()
     where user_id = new.to_user
       and type = 'friend_request_received'
       and (payload->>'request_id')::uuid = new.id
       and read_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists friend_requests_after_update on public.friend_requests;
create trigger friend_requests_after_update
  after update on public.friend_requests
  for each row execute function public.on_friend_request_accepted();

-- ────────────────────────────────────────────────────────────
-- PARTE 3 · MIGRACIÓN DE STATUS LEGACY
-- ────────────────────────────────────────────────────────────

-- 'completed' → 'confirmed' (datos ya tenían rating aplicado)
update public.matches
   set status = 'confirmed'
 where status = 'completed';

-- 'voided' → 'void' (unificar nomenclatura)
update public.matches
   set status = 'void'
 where status = 'voided';

-- Expandir el check de status. Nuevo set definitivo:
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in (
    'in_progress', 'pending_attestation',
    'confirmed', 'disputed', 'void', 'cancelled'
  ));

-- Columnas para el flow de attestation
alter table public.matches
  add column if not exists scorekeeper_id uuid references auth.users(id) on delete set null,
  add column if not exists finalized_at   timestamptz,
  add column if not exists confirmed_at   timestamptz,
  add column if not exists rated_at       timestamptz;

-- Datos legacy: los matches ya confirmed están rated (tenían 'completed')
update public.matches
   set rated_at = coalesce(rated_at, finished_at, created_at)
 where status = 'confirmed' and rated_at is null;

create index if not exists idx_matches_pending_finalized
  on public.matches (status, finalized_at)
  where status = 'pending_attestation';

-- ────────────────────────────────────────────────────────────
-- PARTE 4 · TABLA MATCH_ATTESTATIONS
-- ────────────────────────────────────────────────────────────

create table if not exists public.match_attestations (
  match_id   uuid not null references public.matches(id) on delete cascade,
  user_id    uuid not null references auth.users(id)    on delete cascade,
  action     text not null check (action in ('confirm','dispute')),
  comment    text,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index if not exists idx_match_attest_user
  on public.match_attestations (user_id, created_at desc);

alter table public.match_attestations enable row level security;

drop policy if exists match_attest_read_participants on public.match_attestations;
drop policy if exists match_attest_insert_own       on public.match_attestations;
drop policy if exists match_attest_update_own       on public.match_attestations;

-- Participantes pueden leer attestations de la partida
create policy match_attest_read_participants
  on public.match_attestations for select
  to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.match_id = match_attestations.match_id
        and mp.user_id = auth.uid()
    )
  );

-- Insert: solo propia attestation, solo si participante, solo si pending_attestation
create policy match_attest_insert_own
  on public.match_attestations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      join public.match_players mp on mp.match_id = m.id
      where m.id = match_attestations.match_id
        and mp.user_id = auth.uid()
        and m.status = 'pending_attestation'
    )
  );

-- Update: solo propia
create policy match_attest_update_own
  on public.match_attestations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.match_attestations;
exception when duplicate_object then null;
end$$;

-- ────────────────────────────────────────────────────────────
-- PARTE 5 · RPC evaluate_match_quorum
-- ────────────────────────────────────────────────────────────

create or replace function public.evaluate_match_quorum(p_match_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_status     text;
  v_confirms   int;
  v_disputes   int;
  v_new_status text;
begin
  select status into v_status from public.matches where id = p_match_id for update;
  if v_status is null then raise exception 'match_not_found'; end if;
  if v_status <> 'pending_attestation' then return v_status; end if;

  select
    count(*) filter (where action = 'confirm'),
    count(*) filter (where action = 'dispute')
  into v_confirms, v_disputes
  from public.match_attestations
  where match_id = p_match_id;

  -- Regla:
  --   2+ disputes → disputed (consenso de problema)
  --   3+ confirms (con ≤1 dispute, ya implícito porque 2+ disputes ya cayó arriba)
  --     → confirmed
  --   else → sigue pending
  if v_disputes >= 2 then
    v_new_status := 'disputed';
  elsif v_confirms >= 3 then
    v_new_status := 'confirmed';
  else
    v_new_status := 'pending_attestation';
  end if;

  if v_new_status <> v_status then
    update public.matches
       set status       = v_new_status,
           confirmed_at = case when v_new_status = 'confirmed' then now() else confirmed_at end
     where id = p_match_id;
  end if;

  return v_new_status;
end;
$$;

grant execute on function public.evaluate_match_quorum(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 6 · RPC attest_match
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

  -- Upsert: permite cambiar de confirm a dispute o viceversa
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

grant execute on function public.attest_match(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 7 · NUEVA finalize_match — mueve a pending_attestation
-- (reemplaza la versión vieja que aplicaba rating inmediato)
-- ────────────────────────────────────────────────────────────

drop function if exists public.finalize_match(uuid, jsonb);

create or replace function public.finalize_match(p_match_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_match record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.created_by is distinct from v_user then raise exception 'not_authorized'; end if;
  if v_match.status <> 'in_progress' then raise exception 'not_finalizable'; end if;

  update public.matches
     set status         = 'pending_attestation',
         scorekeeper_id = v_user,
         finalized_at   = now(),
         finished_at    = now()
   where id = p_match_id;

  -- Auto-attest del scorekeeper como confirm
  insert into public.match_attestations (match_id, user_id, action)
  values (p_match_id, v_user, 'confirm')
  on conflict (match_id, user_id) do nothing;

  -- Devuelve el estado (típicamente sigue pending_attestation a no ser que
  -- el match sea 1v1 con auto-confirm artificial — no es el caso normal)
  return public.evaluate_match_quorum(p_match_id);
end;
$$;

grant execute on function public.finalize_match(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 8 · apply_match_rating — atomicidad del cálculo OpenSkill
-- (heredado del antiguo finalize_match con signature (uuid, jsonb))
-- Solo se ejecuta cuando el match está CONFIRMED y aún no rated.
-- ────────────────────────────────────────────────────────────

create or replace function public.apply_match_rating(
  p_match_id uuid,
  p_updates  jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match    record;
  v_update   jsonb;
  v_mu_col   text;
  v_sig_col  text;
  v_gms_col  text;
  v_win_col  text;
  v_los_col  text;
  v_user_id  uuid;
  v_rank     int;
  v_won      boolean;
  v_expected int;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'invalid_updates';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_rateable'; end if;
  if v_match.rated_at is not null then return; end if;  -- idempotente

  select count(*) into v_expected from public.match_players where match_id = p_match_id;
  if jsonb_array_length(p_updates) <> v_expected then
    raise exception 'updates_count_mismatch';
  end if;

  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_singles_mu';     v_sig_col := 'd9_singles_sigma';
    v_gms_col := 'd9_singles_games';  v_win_col := 'd9_singles_wins';  v_los_col := 'd9_singles_losses';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_doubles_mu';     v_sig_col := 'd9_doubles_sigma';
    v_gms_col := 'd9_doubles_games';  v_win_col := 'd9_doubles_wins';  v_los_col := 'd9_doubles_losses';
  elsif v_match.format = 'doubles' then
    v_mu_col  := 'doubles_mu';        v_sig_col := 'doubles_sigma';
    v_gms_col := 'doubles_games';     v_win_col := 'doubles_wins';     v_los_col := 'doubles_losses';
  else
    v_mu_col  := 'singles_mu';        v_sig_col := 'singles_sigma';
    v_gms_col := 'singles_games';     v_win_col := 'singles_wins';     v_los_col := 'singles_losses';
  end if;

  for v_update in select * from jsonb_array_elements(p_updates) loop
    v_user_id := (v_update->>'user_id')::uuid;
    v_rank    := (v_update->>'rank')::int;

    if v_user_id is null or v_rank is null or v_rank < 1 then raise exception 'invalid_update_fields'; end if;
    if v_update->>'mu_before' is null or v_update->>'sigma_before' is null
       or v_update->>'mu_after' is null or v_update->>'sigma_after' is null then
      raise exception 'invalid_update_fields';
    end if;
    v_won := v_rank = 1;

    if not exists (
      select 1 from public.match_players where match_id = p_match_id and user_id = v_user_id
    ) then raise exception 'user_not_in_match'; end if;

    update public.match_players set
      rank         = v_rank,
      mu_before    = (v_update->>'mu_before')::numeric,
      sigma_before = (v_update->>'sigma_before')::numeric,
      mu_after     = (v_update->>'mu_after')::numeric,
      sigma_after  = (v_update->>'sigma_after')::numeric
    where match_id = p_match_id and user_id = v_user_id;

    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = $2,
          %I = %I + 1,
          %I = %I + $3,
          %I = %I + $4
        where id = $5
      $q$,
      v_mu_col,  v_sig_col,
      v_gms_col, v_gms_col,
      v_win_col, v_win_col,
      v_los_col, v_los_col
    ) using
      (v_update->>'mu_after')::numeric,
      (v_update->>'sigma_after')::numeric,
      case when v_won then 1 else 0 end,
      case when v_won then 0 else 1 end,
      v_user_id;
  end loop;

  update public.matches set rated_at = now() where id = p_match_id;
end;
$$;

grant execute on function public.apply_match_rating(uuid, jsonb) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 9 · auto_confirm_stale_matches (cron-friendly)
-- ────────────────────────────────────────────────────────────

create or replace function public.auto_confirm_stale_matches()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int := 0;
  m record;
begin
  for m in
    select id from public.matches
     where status = 'pending_attestation'
       and finalized_at < now() - interval '7 days'
       and not exists (
         select 1 from public.match_attestations a
         where a.match_id = matches.id and a.action = 'dispute'
       )
  loop
    update public.matches
       set status = 'confirmed',
           confirmed_at = now()
     where id = m.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.auto_confirm_stale_matches() to service_role;
grant execute on function public.auto_confirm_stale_matches() to authenticated;
-- Nota: el rating se aplica vía TS (server action) cuando un usuario navega a
-- un match auto-confirmado, o vía cron complementario. Ver match-actions.ts.

-- ────────────────────────────────────────────────────────────
-- PARTE 10 · NOTIFICATION TRIGGERS PARA EVENTOS DE ATTESTATION
-- ────────────────────────────────────────────────────────────

-- attest_requested: cuando match pasa a pending_attestation
create or replace function public.notify_attest_requested()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'pending_attestation'
     and (old.status is null or old.status <> 'pending_attestation') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id, 'attest_requested', new.id,
           jsonb_build_object('scorekeeper_id', new.scorekeeper_id)
    from public.match_players mp
    where mp.match_id = new.id
      and mp.user_id is distinct from new.scorekeeper_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_attest_requested on public.matches;
create trigger trg_notify_attest_requested
  after update of status on public.matches
  for each row execute function public.notify_attest_requested();

-- match_confirmed/disputed/auto_confirmed
create or replace function public.notify_match_resolved()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'pending_attestation' and new.status in ('confirmed', 'disputed') then
    insert into public.notifications (user_id, type, ref_match_id, payload)
    select mp.user_id,
           case
             when new.status = 'confirmed' and new.finalized_at is not null
                  and (now() - new.finalized_at) > interval '6 days'
               then 'match_auto_confirmed'
             when new.status = 'confirmed' then 'match_confirmed'
             else 'match_disputed'
           end,
           new.id, '{}'::jsonb
    from public.match_players mp
    where mp.match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_match_resolved on public.matches;
create trigger trg_notify_match_resolved
  after update of status on public.matches
  for each row execute function public.notify_match_resolved();

-- attest_action: cuando alguien firma/disputa, notifica a los demás participantes
create or replace function public.notify_attest_action()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, ref_match_id, payload)
  select mp.user_id, 'attest_action', new.match_id,
         jsonb_build_object('actor_id', new.user_id, 'action', new.action)
  from public.match_players mp
  where mp.match_id = new.match_id
    and mp.user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_attest_action on public.match_attestations;
create trigger trg_notify_attest_action
  after insert or update on public.match_attestations
  for each row execute function public.notify_attest_action();

-- ────────────────────────────────────────────────────────────
-- PARTE 11 · ADMIN ROLE
-- ────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'admin'));

-- Promueve a admin al usuario "kako" o, si no existe, al primer usuario.
-- Carlos puede ajustar manualmente vía UPDATE si su username difiere.
update public.profiles
   set role = 'admin'
 where username = 'kako';

-- ────────────────────────────────────────────────────────────
-- PARTE 12 · ACTUALIZAR void_match para usar nuevo enum
-- ────────────────────────────────────────────────────────────

create or replace function public.void_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_match    record;
  v_player   record;
  v_mu_col   text;
  v_sig_col  text;
  v_gms_col  text;
  v_win_col  text;
  v_los_col  text;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.created_by is distinct from auth.uid() then raise exception 'not_authorized'; end if;
  if v_match.status <> 'confirmed' then raise exception 'not_voidable'; end if;

  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_singles_mu';     v_sig_col := 'd9_singles_sigma';
    v_gms_col := 'd9_singles_games';  v_win_col := 'd9_singles_wins';  v_los_col := 'd9_singles_losses';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_doubles_mu';     v_sig_col := 'd9_doubles_sigma';
    v_gms_col := 'd9_doubles_games';  v_win_col := 'd9_doubles_wins';  v_los_col := 'd9_doubles_losses';
  elsif v_match.format = 'doubles' then
    v_mu_col  := 'doubles_mu';        v_sig_col := 'doubles_sigma';
    v_gms_col := 'doubles_games';     v_win_col := 'doubles_wins';     v_los_col := 'doubles_losses';
  else
    v_mu_col  := 'singles_mu';        v_sig_col := 'singles_sigma';
    v_gms_col := 'singles_games';     v_win_col := 'singles_wins';     v_los_col := 'singles_losses';
  end if;

  for v_player in
    select user_id, mu_before, sigma_before, rank
    from public.match_players
    where match_id = p_match_id
  loop
    if v_player.mu_before is null or v_player.sigma_before is null then
      raise exception 'corrupted_snapshot';
    end if;

    execute format(
      $q$ update public.profiles set
            %I = $1, %I = $2,
            %I = greatest(%I - 1, 0),
            %I = greatest(%I - $3, 0),
            %I = greatest(%I - $4, 0)
          where id = $5 $q$,
      v_mu_col,  v_sig_col,
      v_gms_col, v_gms_col,
      v_win_col, v_win_col,
      v_los_col, v_los_col
    ) using
      v_player.mu_before, v_player.sigma_before,
      case when v_player.rank = 1 then 1 else 0 end,
      case when v_player.rank <> 1 then 1 else 0 end,
      v_player.user_id;
  end loop;

  update public.matches
     set status = 'void',
         finished_at = null,
         rated_at = null
   where id = p_match_id;
end;
$$;

grant execute on function public.void_match(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 13 · ADMIN: resolver disputes
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_resolve_match(
  p_match_id uuid,
  p_resolution text                              -- 'confirm' | 'void'
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_match record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select role into v_role from public.profiles where id = v_user;
  if v_role is distinct from 'admin' then raise exception 'not_admin'; end if;

  if p_resolution not in ('confirm','void') then raise exception 'invalid_resolution'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.status not in ('disputed','pending_attestation') then
    raise exception 'not_resolvable';
  end if;

  if p_resolution = 'confirm' then
    update public.matches
       set status = 'confirmed', confirmed_at = now()
     where id = p_match_id;
  else
    update public.matches
       set status = 'void'
     where id = p_match_id;
  end if;

  return p_resolution;
end;
$$;

grant execute on function public.admin_resolve_match(uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────
-- PARTE 14 · search_users con ordenamiento "amigos primero"
-- (revertimos Q1 — el filtro friendsOnly se elimina del UI, pero
-- queremos que los amigos aparezcan arriba en results globales)
-- ────────────────────────────────────────────────────────────

drop function if exists public.search_users(text, int, boolean);

create or replace function public.search_users(
  q text,
  lim int default 10,
  exclude_self boolean default true
)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
  country         text,
  global_display  numeric,
  total_games     int,
  is_friend       boolean
)
language sql stable as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    p.country,
    pr.global_display,
    pr.total_games::int,
    (f.user_id is not null) as is_friend
  from public.profiles p
  left join public.profile_ratings pr on pr.id = p.id
  left join public.friendships f
    on f.user_id = auth.uid() and f.friend_id = p.id
  where (
    q is null or q = ''
    or p.username ilike q || '%'
    or p.username ilike '%' || q || '%'
    or p.display_name ilike '%' || q || '%'
  )
    and (not exclude_self or p.id <> auth.uid())
  order by
    (f.user_id is not null) desc,                                   -- amigos primero
    case when p.username ilike q || '%' then 0
         when p.username ilike '%' || q || '%' then 1
         else 2 end,
    p.username
  limit lim
$$;

grant execute on function public.search_users(text, int, boolean) to authenticated;
