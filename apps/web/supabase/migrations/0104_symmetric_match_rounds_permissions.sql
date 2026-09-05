-- ============================================================
-- 0104 — RLS simétrica en match_rounds: cualquier match_player anota
-- ============================================================
-- Contexto:
--   El modelo previo (mig 0057-0060) tenía un score-keeper único por
--   partida. Solo el keeper podía INSERT rounds; UPDATE/DELETE tenían
--   reglas complejas con attestation. La realidad de dominó (4 amigos
--   en la mesa) es que se turnan anotando — el modelo generaba fricción:
--   un participante del torneo entraba a anotar y recibía RLS error.
--
--   Reportado 2026-08-03: un jugador de un torneo se metía a anotar
--   puntos en su propia partida y le daba error.
--
-- Cambio:
--   INSERT/UPDATE/DELETE en match_rounds ahora aceptan a CUALQUIER
--   match_player del match. La confianza es social: los 4 se ven en la
--   mesa y el audit (recorded_by_user_id, last_edited_by_user_id,
--   edit_count) registra quién hizo qué.
--
-- Se retira:
--   • Policy `match_rounds_insert_score_keeper` (mig 0058)
--   • Policy `match_rounds_update_authorized` (mig 0058)
--   • Policy `match_rounds_delete_creator`   (mig 0058)
--
-- Se simplifica (backward compat de signature):
--   • `can_record_hand(match_id, user_id)` → true si user es match_player
--   • `can_edit_hand(round_id, user_id)`  → (true,'match_player') si el
--     user es match_player del match del round, else (false,'not_player').
--     Se mantiene el chequeo de match_not_in_progress y round_not_found
--     para consistencia con el spec original.
--
-- Se agrega:
--   • RPC `insert_match_round(p_match_id, p_team, p_points, p_kind)`.
--     Atómica: SELECT max(round_number)+1 + INSERT dentro de la misma
--     transacción. Elimina el race entre 2 jugadores anotando a la vez.
--     La RLS se aplica normal porque la RPC es security invoker.
--
-- Se deja dormido (cleanup en PR aparte):
--   • matches.scorekeeper_id (columna)
--   • match_score_keepers (tabla y audit log)
--   • transfer_score_keeper (RPC)
--   • notificación 'score_keeper_received'
--   • match_rounds.attestation_required / .attestation_status
--
-- ============================================================

-- 1. Simplificar can_record_hand: gate = match_player.

create or replace function public.can_record_hand(
  p_match_id uuid,
  p_user_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_players
     where match_id = p_match_id
       and user_id = p_user_id
  )
$$;

comment on function public.can_record_hand(uuid, uuid) is
  'Returns true if the given user is a player in the match. Symmetric permission model — any of the 4 at the table can score. Prev model (0058) required active score-keeper; simplified 2026-08-03.';

-- 2. Simplificar can_edit_hand: gate = match_player.
--    Mantiene checks defensivos de round/match para no cambiar la firma
--    de retorno ni sorprender a callers externos.

create or replace function public.can_edit_hand(
  p_round_id bigint,
  p_user_id uuid
) returns table(allowed boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_match_id uuid;
  v_match_status text;
  v_is_player boolean;
begin
  select match_id into v_match_id from public.match_rounds where id = p_round_id;
  if not found then
    return query select false, 'round_not_found'::text;
    return;
  end if;

  select status into v_match_status from public.matches where id = v_match_id;
  if not found then
    return query select false, 'match_not_found'::text;
    return;
  end if;

  if v_match_status <> 'in_progress' then
    return query select false, 'match_not_in_progress'::text;
    return;
  end if;

  select exists (
    select 1 from public.match_players
     where match_id = v_match_id
       and user_id = p_user_id
  ) into v_is_player;

  if v_is_player then
    return query select true, 'match_player'::text;
  else
    return query select false, 'not_player'::text;
  end if;
end;
$$;

comment on function public.can_edit_hand(bigint, uuid) is
  'Returns (allowed, reason) tuple. Symmetric model: any match_player can edit while match is in_progress. Reasons: match_player, not_player, match_not_in_progress, round_not_found, match_not_found. Prev model (0058) had author-window + host-override + attestation; simplified 2026-08-03.';

-- 3. Reescribir RLS de match_rounds.
--    SELECT policy (read all) se mantiene desde 0005.

drop policy if exists match_rounds_insert_score_keeper on public.match_rounds;
drop policy if exists match_rounds_update_authorized   on public.match_rounds;
drop policy if exists match_rounds_delete_creator      on public.match_rounds;

-- INSERT: cualquier match_player del match. recorded_by_user_id debe ser
-- auth.uid() para preservar attribution honesta (nadie inserta a nombre
-- de otro).
create policy match_rounds_insert_match_player
  on public.match_rounds for insert
  with check (
    exists (
      select 1 from public.match_players mp
       where mp.match_id = match_rounds.match_id
         and mp.user_id = auth.uid()
    )
    and (recorded_by_user_id is null or recorded_by_user_id = auth.uid())
  );

-- UPDATE: cualquier match_player del match, solo mientras in_progress.
-- El estado del match se chequea via join a matches.
create policy match_rounds_update_match_player
  on public.match_rounds for update
  using (
    exists (
      select 1
        from public.match_players mp
        join public.matches m on m.id = mp.match_id
       where mp.match_id = match_rounds.match_id
         and mp.user_id = auth.uid()
         and m.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1
        from public.match_players mp
        join public.matches m on m.id = mp.match_id
       where mp.match_id = match_rounds.match_id
         and mp.user_id = auth.uid()
         and m.status = 'in_progress'
    )
  );

-- DELETE: cualquier match_player, solo mientras in_progress.
create policy match_rounds_delete_match_player
  on public.match_rounds for delete
  using (
    exists (
      select 1
        from public.match_players mp
        join public.matches m on m.id = mp.match_id
       where mp.match_id = match_rounds.match_id
         and mp.user_id = auth.uid()
         and m.status = 'in_progress'
    )
  );

-- 4. RPC atómica de insert.
--    Con la RLS abierta a 4 jugadores, el SELECT max()+INSERT en TS tiene
--    race: 2 users leen last=5 → ambos intentan INSERT round_number=6 →
--    duplicate key en unique(match_id, round_number). Esta RPC hace todo
--    dentro de una sola transacción con LOCK del match_id para serializar
--    lecturas.
--
--    security invoker → RLS de match_rounds_insert_match_player aplica
--    igual, no bypass.

create or replace function public.insert_match_round(
  p_match_id uuid,
  p_team int,
  p_points int,
  p_kind text
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_next_round int;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Advisory lock por match_id para serializar inserts concurrentes.
  -- hashtextextended da un bigint estable a partir del uuid.
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select coalesce(max(round_number), 0) + 1
    into v_next_round
    from public.match_rounds
   where match_id = p_match_id;

  insert into public.match_rounds
    (match_id, round_number, team, points, kind, created_by, recorded_by_user_id)
  values
    (p_match_id, v_next_round, p_team, p_points, p_kind, v_uid, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.insert_match_round(uuid, int, int, text) is
  'Inserta una mano atómicamente. Advisory lock por match_id serializa inserts concurrentes de 2+ jugadores. RLS match_rounds_insert_match_player se aplica normalmente (security invoker).';

grant execute on function public.insert_match_round(uuid, int, int, text) to authenticated;

-- ============================================================
-- VERIFICACIÓN post-deploy
-- ============================================================
-- 1. Policies renombradas:
--      select polname from pg_policy where polrelid = 'public.match_rounds'::regclass;
--    Esperado: match_rounds_read_all + match_rounds_insert_match_player
--    + match_rounds_update_match_player + match_rounds_delete_match_player.
--
-- 2. Funciones simplificadas:
--      select public.can_record_hand('<match>', '<player_uid>');   -- true
--      select * from public.can_edit_hand(<round_id>, '<player_uid>'); -- (true, match_player)
--
-- 3. Insert atómico funcionando:
--      select public.insert_match_round('<match>', 1, 25, 'points'); -- retorna id
-- ============================================================
