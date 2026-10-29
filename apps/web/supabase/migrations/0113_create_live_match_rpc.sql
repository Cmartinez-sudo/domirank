-- ============================================================
-- 0113 — create_live_match RPC (atómica) + limpieza de huérfanas
-- ============================================================
-- BUG: al entrar a jugar una partida de torneo desde el fast path
-- aparecía "duplicate key value violates unique constraint
-- matches_one_inprogress_per_user".
--
-- Causa raíz (startLiveMatch, src/lib/live-match.ts):
--   1. La creación eran 3 llamadas separadas desde el cliente:
--      INSERT matches → INSERT match_players → (si falla) DELETE matches.
--      matches no tiene policy DELETE (mig 0001), así que RLS ignoraba el
--      DELETE en silencio y quedaba una partida in_progress SIN jugadores.
--      El INSERT de match_players falla, p. ej., por el trigger
--      trg_one_active_match (mig 0059) cuando algún jugador ya está en
--      otra partida in_progress / pending_attestation.
--   2. Antes de crear, startLiveMatch cancelaba las in_progress previas
--      del creador con rpc('cancel_match', 'replaced_by_new_match') sin
--      revisar el error. Desde 0072, con JWT cancel_match exige que el
--      caller esté en match_players → con una huérfana (o una partida
--      donde el creador no juega) lanza 'Only participants can cancel a
--      match', el error se tragaba y el INSERT chocaba con el índice
--      matches_one_inprogress_per_user (created_by WHERE in_progress).
--      A partir de ahí el usuario no puede crear NINGUNA partida.
--
-- Fix:
--   A. RPC create_live_match (SECURITY DEFINER): en UNA transacción
--      valida auth.uid(), exige que el creador sea uno de los 4 jugadores,
--      cancela sus in_progress previas ('replaced_by_new_match'), detecta
--      jugadores con otra partida activa (devuelve quién, sin crear nada),
--      inserta matches + match_players y, si viene p_pairing_id, vincula
--      el pairing. Si algo falla, rollback completo: no hay huérfanas.
--      Con p_pairing_id el pairing se bloquea FOR UPDATE: un doble render /
--      doble submit del fast path devuelve la misma partida en vez de
--      intentar crear otra.
--   B. Limpieza: cancela ('migration_cleanup') las in_progress existentes
--      sin match_players.
--
-- Índice matches_one_inprogress_per_user: se CONSERVA. El trigger 0059 solo
-- corre al insertar match_players, así que no ve partidas sin jugadores;
-- el índice es el único backstop contra huérfanas que se acumulan por
-- caminos que todavía insertan directo vía PostgREST (polla,
-- continuous-league-actions.ts). Con la RPC nunca se dispara en el camino
-- normal: las previas se cancelan antes del INSERT bajo un advisory lock
-- por creador.
--
-- No toca rating ni el flujo de confirmación 3 de 4.
-- Dependencias: 0005, 0059, 0066, 0073 (trigger score keeper), 0031.
-- ============================================================

create or replace function public.create_live_match(
  p_team_a             uuid[],
  p_team_b             uuid[],
  p_count_rule         text,
  p_modality           text,
  p_format             text,
  p_set_size           text,
  p_target_points      integer,
  p_capicua_bonus      integer,
  p_rated              boolean,
  p_tournament_id      uuid    default null,
  p_time_limit_minutes integer default null,
  p_pairing_id         bigint  default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_players   uuid[];
  v_pairing   public.tournament_pairings%rowtype;
  v_existing  record;
  v_conflict  record;
  v_prev      record;
  v_match_id  uuid;
begin
  if v_caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if coalesce(array_length(p_team_a, 1), 0) <> 2
     or coalesce(array_length(p_team_b, 1), 0) <> 2 then
    raise exception 'invalid_teams' using errcode = '22023';
  end if;

  v_players := p_team_a || p_team_b;
  if (select count(distinct u) from unnest(v_players) u) <> 4 then
    raise exception 'duplicate_player' using errcode = '22023';
  end if;

  -- cancel_match exige ser participante: un creador que no juega no podría
  -- cancelar su propia partida y quedaría bloqueado por el índice único.
  if not (v_caller = any(v_players)) then
    raise exception 'creator_not_player' using errcode = '42501';
  end if;

  -- Serializa creaciones concurrentes del mismo usuario (doble submit).
  perform pg_advisory_xact_lock(hashtextextended('create_live_match:' || v_caller::text, 0));

  -- Pairing de torneo: bloquear la fila y ser idempotente.
  if p_pairing_id is not null then
    select * into v_pairing
      from public.tournament_pairings
     where id = p_pairing_id
     for update;

    if not found then
      raise exception 'pairing_not_found' using errcode = 'P0002';
    end if;
    if p_tournament_id is distinct from v_pairing.tournament_id then
      raise exception 'match_not_in_tournament' using errcode = '22023';
    end if;
    if not (v_caller = any(v_pairing.team_a_user_ids) or v_caller = any(v_pairing.team_b_user_ids)) then
      raise exception 'not_a_player_of_this_pairing' using errcode = '42501';
    end if;

    if v_pairing.match_id is not null then
      select id, status into v_existing from public.matches where id = v_pairing.match_id;
      if found and v_existing.status = 'in_progress' then
        return jsonb_build_object('ok', true, 'match_id', v_existing.id, 'reused', true);
      end if;
      raise exception 'pairing_already_has_match' using errcode = 'P0001';
    end if;
  end if;

  -- ¿Algún jugador ya está en otra partida activa? Se ignoran las
  -- in_progress del propio creador porque se cancelan abajo.
  select a.user_id, a.match_id, a.status, p.username, p.display_name
    into v_conflict
    from public.active_matches_per_user a
    join public.profiles p on p.id = a.user_id
   where a.user_id = any(v_players)
     and not (a.created_by = v_caller and a.status = 'in_progress')
   order by (a.user_id = v_caller) desc
   limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'player_has_active_match',
      'user_id', v_conflict.user_id,
      'username', v_conflict.username,
      'display_name', v_conflict.display_name,
      'match_id', v_conflict.match_id,
      'match_status', v_conflict.status,
      'is_self', v_conflict.user_id = v_caller
    );
  end if;

  -- Cancelar las in_progress previas del creador (incluye huérfanas sin
  -- jugadores). Inline y no vía cancel_match: con JWT cancel_match fuerza
  -- 'user_cancelled' + participant check. El creador ya puede hacer UPDATE
  -- de sus propias partidas (policy matches_update_creator), así que esto
  -- no amplía permisos. Sistémica: sin undo window ni notificaciones,
  -- igual que cancel_match con 'replaced_by_new_match'.
  for v_prev in
    select id from public.matches
     where created_by = v_caller and status = 'in_progress'
     for update
  loop
    update public.matches set
      status                  = 'cancelled',
      cancelled_at            = now(),
      cancelled_by_user_id    = v_caller,
      cancellation_reason     = 'replaced_by_new_match',
      cancellation_undo_until = null
     where id = v_prev.id;

    insert into public.match_cancellation_events (match_id, action, actor_user_id, reason)
    values (v_prev.id, 'cancelled', v_caller, 'replaced_by_new_match');
  end loop;

  insert into public.matches (
    format, set_size, modality, count_rule, target_points, capicua_bonus,
    status, rated, created_by, tournament_id,
    time_limit_minutes, timer_started_at
  ) values (
    p_format, p_set_size, coalesce(p_modality, 'custom'), p_count_rule,
    p_target_points, p_capicua_bonus,
    'in_progress', p_rated, v_caller, p_tournament_id,
    p_time_limit_minutes, case when p_time_limit_minutes is not null then now() end
  )
  returning id into v_match_id;

  -- trg_one_active_match (0059) sigue corriendo aquí como backstop ante
  -- carreras con otros usuarios; si lanza, se revierte todo lo anterior.
  insert into public.match_players (match_id, user_id, team, score)
  select v_match_id, u, 1, 0 from unnest(p_team_a) u
  union all
  select v_match_id, u, 2, 0 from unnest(p_team_b) u;

  if p_pairing_id is not null then
    update public.tournament_pairings set match_id = v_match_id where id = p_pairing_id;
  end if;

  return jsonb_build_object('ok', true, 'match_id', v_match_id, 'reused', false);
end;
$$;

comment on function public.create_live_match(uuid[], uuid[], text, text, text, text, integer, integer, boolean, uuid, integer, bigint) is
  'Crea una partida en vivo (matches + match_players [+ vínculo a pairing]) en una sola transacción. Valida auth.uid() como jugador, cancela sus in_progress previas (replaced_by_new_match) y devuelve {ok:false,error:player_has_active_match,...} si algún jugador ya tiene otra partida activa. Idempotente por pairing.';

revoke all on function public.create_live_match(uuid[], uuid[], text, text, text, text, integer, integer, boolean, uuid, integer, bigint) from public, anon;
grant execute on function public.create_live_match(uuid[], uuid[], text, text, text, text, integer, integer, boolean, uuid, integer, bigint) to authenticated;

-- ───── Limpieza: huérfanas in_progress sin match_players ─────
-- 'migration_cleanup' es una reason sistémica permitida (0066): final, sin
-- undo y sin notificaciones (no hay participantes a quién avisar).
-- Los triggers de status (0016/0020/0030/0054/0093) solo reaccionan a
-- 'confirmed' / 'pending_attestation', así que no afecta torneos ni rating.

with orphans as (
  update public.matches m set
    status                  = 'cancelled',
    cancelled_at            = now(),
    cancelled_by_user_id    = null,
    cancellation_reason     = 'migration_cleanup',
    cancellation_undo_until = null
   where m.status = 'in_progress'
     and not exists (select 1 from public.match_players mp where mp.match_id = m.id)
  returning m.id
)
insert into public.match_cancellation_events (match_id, action, actor_user_id, reason)
select id, 'cancelled', null, 'migration_cleanup' from orphans;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Sin huérfanas:
--      select count(*) from public.matches m
--       where m.status = 'in_progress'
--         and not exists (select 1 from public.match_players mp where mp.match_id = m.id);
--    Esperado: 0.
-- 2. Auditoría de la limpieza:
--      select count(*) from public.match_cancellation_events
--       where reason = 'migration_cleanup' and created_at > now() - interval '1 hour';
-- 3. La RPC existe y solo authenticated la ejecuta:
--      select has_function_privilege('anon',
--        'public.create_live_match(uuid[],uuid[],text,text,text,text,integer,integer,boolean,uuid,integer,bigint)',
--        'execute');   -- false
-- ============================================================
