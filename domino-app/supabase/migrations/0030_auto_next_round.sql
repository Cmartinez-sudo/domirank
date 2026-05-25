-- ============================================================
-- 0030 — Auto-Advance Tournament Round (R7)
-- ============================================================
-- Idempotente: usa CREATE OR REPLACE, DROP IF EXISTS, etc.
-- Requisito previo: 0029_time_based_matches.sql ya aplicado.
--
-- Patrón Vault para secretos (igual que 0026_push_subscriptions):
--   Lee de vault.decrypted_secrets en vez de current_setting().
--   Esto es necesario porque Supabase managed Postgres no concede
--   superuser al rol del SQL editor, y ALTER DATABASE SET ... requiere
--   superuser. Vault es el patrón soportado.
--
-- Secreto requerido (crear una sola vez en Dashboard → Vault):
--   Name:   generate_round_url
--   Secret: https://[PROJECT_REF].supabase.co/functions/v1/generate-tournament-round
--
-- El secreto service_role_key ya existe desde 0026 (push notifications).
-- ============================================================

-- ─── 1. Función trigger: detecta ronda completa y dispara el edge function ──

create or replace function public.notify_round_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id     uuid;
  v_current_round     int;
  v_total_rounds      int;
  v_format            text;
  v_pending_matches   int;
  v_url               text;
  v_key               text;
begin
  -- Solo aplica a partidas con tournament_id
  if new.tournament_id is null then
    return new;
  end if;

  -- Solo disparar cuando el status cambia A 'confirmed' (no si ya era confirmed)
  if old.status = 'confirmed' or new.status <> 'confirmed' then
    return new;
  end if;

  -- Leer datos del torneo
  select
    t.id,
    t.current_round,
    t.total_rounds,
    t.format
  into
    v_tournament_id,
    v_current_round,
    v_total_rounds,
    v_format
  from public.tournaments t
  where t.id = new.tournament_id;

  -- Solo aplicable a formatos swiss y round_robin (single_elim avanza por bracket)
  if v_format not in ('swiss', 'round_robin') then
    return new;
  end if;

  -- Verificar si la ronda actual tiene partidas pendientes o sin confirmar.
  -- Conservador ante matches void: un pairing con match_id apuntando a un
  -- match void (status = 'void') NO se cuenta como "confirmed", por lo que
  -- el trigger no dispara. El organizador deberá resolver manualmente.
  select count(*) into v_pending_matches
  from public.tournament_pairings tp
  where tp.tournament_id = v_tournament_id
    and tp.round = v_current_round
    and (
      tp.match_id is null
      or not exists (
        select 1 from public.matches m
        where m.id = tp.match_id
          and m.status = 'confirmed'
      )
    );

  -- Si quedan partidas pendientes, no hacer nada todavía
  if v_pending_matches > 0 then
    return new;
  end if;

  -- Todos los pairings de la ronda están confirmados.
  -- ¿Era la última ronda?
  if v_current_round >= v_total_rounds then
    -- Finalizar el torneo
    update public.tournaments
      set status = 'finished', finished_at = now()
    where id = v_tournament_id;

    -- Notificar a todos los participantes
    insert into public.notifications (user_id, type, ref_tournament_id)
    select tp.user_id, 'tournament_finished', v_tournament_id
    from public.tournament_players tp
    where tp.tournament_id = v_tournament_id;

    return new;
  end if;

  -- Hay más rondas: disparar edge function para generar la siguiente.
  -- Patrón Vault (idéntico a notify_push_on_critical de 0026).
  select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'generate_round_url'
    limit 1;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  -- Solo disparar si ambos secretos están configurados.
  -- Sin v_key el edge function rechazaría la llamada de todas formas.
  if v_url is not null and v_url <> ''
  and v_key is not null and v_key <> '' then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object(
        'tournament_id',    v_tournament_id,
        'completed_round',  v_current_round
      )::text
    );
  end if;

  return new;
end;
$$;

-- ─── 2. Trigger en matches ───────────────────────────────────────────────────

drop trigger if exists trg_auto_advance_round on public.matches;

create trigger trg_auto_advance_round
  after update of status on public.matches
  for each row
  execute function public.notify_round_complete();

-- ─── 3. RPC generate_next_round_rpc ─────────────────────────────────────────
-- Expone la generación de siguiente ronda al edge function (service role).
-- La lógica de Berger/Swiss está en TypeScript (tournament-formats-engine.ts),
-- por lo que este RPC solo lee los datos necesarios y devuelve los pairings
-- computados por el edge function en forma de INSERT.
--
-- Dado que el algoritmo vive en TS, el RPC actúa como un procedimiento de
-- "commit" de pairings: recibe los pairings ya calculados y los inserta.

create or replace function public.generate_next_round_rpc(
  p_tournament_id   uuid,
  p_next_round      int,
  p_pairings        jsonb  -- array de {team_a_user_ids, team_b_user_ids, board}
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament    record;
  v_pairing       jsonb;
  v_inserted      int := 0;
begin
  -- Verificar que el torneo existe y está en progreso
  select id, status, current_round, total_rounds, format
  into v_tournament
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_found');
  end if;

  if v_tournament.status not in ('in_progress') then
    return jsonb_build_object('ok', false, 'error', 'tournament_not_in_progress');
  end if;

  -- Guard: no insertar si ya existen pairings para esta ronda
  if exists (
    select 1 from public.tournament_pairings
    where tournament_id = p_tournament_id
      and round = p_next_round
  ) then
    return jsonb_build_object('ok', true, 'inserted', 0, 'note', 'round_already_exists');
  end if;

  -- Insertar pairings calculados por el edge function
  for v_pairing in select * from jsonb_array_elements(p_pairings) loop
    insert into public.tournament_pairings (
      tournament_id,
      round,
      board,
      team_a_user_ids,
      team_b_user_ids
    )
    values (
      p_tournament_id,
      p_next_round,
      (v_pairing->>'board')::int,
      array(select jsonb_array_elements_text(v_pairing->'team_a_user_ids'))::uuid[],
      array(select jsonb_array_elements_text(v_pairing->'team_b_user_ids'))::uuid[]
    );
    v_inserted := v_inserted + 1;
  end loop;

  -- Avanzar current_round
  update public.tournaments
    set current_round = p_next_round
  where id = p_tournament_id;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'next_round', p_next_round);
end;
$$;

-- Solo el service role (edge function) puede llamar este RPC
-- Los usuarios autenticados NO tienen acceso directo
revoke execute on function public.generate_next_round_rpc(uuid, int, jsonb) from public;
revoke execute on function public.generate_next_round_rpc(uuid, int, jsonb) from authenticated;
revoke execute on function public.generate_next_round_rpc(uuid, int, jsonb) from anon;

-- ============================================================
-- PASOS MANUALES POST-MIGRACIÓN
-- ============================================================
--
-- 1. Crear el secreto en Vault (si no existe todavía):
--    En Supabase Dashboard → Project Settings → Vault → "Add new secret"
--
--      Name:   generate_round_url
--      Secret: https://[PROJECT_REF].supabase.co/functions/v1/generate-tournament-round
--
--    Alternativa SQL (en el SQL Editor):
--      select vault.create_secret(
--        'https://[PROJECT_REF].supabase.co/functions/v1/generate-tournament-round',
--        'generate_round_url'
--      );
--
--    NOTA: service_role_key ya debe existir en Vault desde la migración 0026
--    (push notifications). Si no existe, crearlo también:
--      select vault.create_secret('[SERVICE_ROLE_KEY]', 'service_role_key');
--
-- 2. Verificar que pg_net esté habilitado (ya instalado en 0026):
--    select extname from pg_extension where extname = 'pg_net';
--
-- 3. Desplegar el edge function:
--    supabase functions deploy generate-tournament-round
--
-- 4. Verificar con:
--    select trigger_name, event_manipulation, event_object_table
--    from information_schema.triggers
--    where trigger_name = 'trg_auto_advance_round';
--
--    select routine_name from information_schema.routines
--    where routine_name in ('notify_round_complete', 'generate_next_round_rpc')
--      and routine_schema = 'public';
-- ============================================================
