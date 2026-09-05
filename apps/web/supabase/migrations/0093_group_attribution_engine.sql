-- ============================================================
-- 0093 — Attribution engine: trigger + función reutilizable
-- ============================================================
-- Fase C+D — Fase 3. Atribuye partidas a grupos cuando los N
-- jugadores son miembros activos.
--
-- Decisiones del grilling 2026-06-22 (Fase 3):
--  #1 Trigger SQL (no server action).
--  #2 Retroactive vía server action; misma función helper se reutiliza.
--  #4 allow_friendlies=false filtra al insertar (no al render).
--  #5 Historial inmutable: atribución se conserva si alguien sale.
--  #6 Match void: atribución se conserva; el leaderboard filtra por status='confirmed'.
--  #7 Trigger se dispara cuando status pasa a 'confirmed' (con o sin attestation).
--  #8 Síncrono.
--
-- Función: attribute_match_to_groups(p_match_id, p_attribution_type)
--   - Lee match_players del match → set de user_ids.
--   - Encuentra grupos donde TODOS los user_ids son active members,
--     groups.is_active=true, y (matches.rated=true OR groups.allow_friendlies=true).
--   - INSERT ON CONFLICT DO NOTHING en group_match_attributions.
--
-- Trigger: AFTER UPDATE en matches, WHEN OLD.status IS DISTINCT FROM 'confirmed'
--          AND NEW.status = 'confirmed'.
-- ============================================================

create or replace function public.attribute_match_to_groups(
  p_match_id uuid,
  p_attribution_type text default 'automatic'
)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match_rated boolean;
  v_player_count int;
  v_inserted int := 0;
begin
  if p_attribution_type not in ('automatic', 'retroactive', 'manual') then
    raise exception 'invalid attribution_type: %', p_attribution_type;
  end if;

  -- Leer flag rated del match (decide qué grupos pueden recibir la atribución).
  select rated into v_match_rated from public.matches where id = p_match_id;
  if v_match_rated is null then
    -- match no existe → noop.
    return 0;
  end if;

  -- Contar jugadores del match (para validar que TODOS coincidan en cada grupo candidato).
  select count(*)
    into v_player_count
    from public.match_players
   where match_id = p_match_id;

  if v_player_count = 0 then
    return 0;
  end if;

  -- Insertar atribuciones para cada grupo elegible.
  -- ON CONFLICT DO NOTHING garantiza idempotencia (UNIQUE en group_id, match_id).
  with eligible_groups as (
    select gm.group_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where gm.status = 'active'
       and g.is_active = true
       -- Decisión #4: si la partida es amistosa (rated=false), solo grupos con
       -- allow_friendlies=true reciben la atribución.
       and (v_match_rated = true or g.allow_friendlies = true)
       and gm.user_id in (
         select user_id from public.match_players where match_id = p_match_id
       )
     group by gm.group_id
    having count(distinct gm.user_id) = v_player_count
  )
  insert into public.group_match_attributions (group_id, match_id, attribution_type)
  select eg.group_id, p_match_id, p_attribution_type
    from eligible_groups eg
  on conflict (group_id, match_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.attribute_match_to_groups(uuid, text) is
  'Atribuye un match a todos los grupos donde sus jugadores son miembros activos. Fase C+D #3.';

grant execute on function public.attribute_match_to_groups(uuid, text) to authenticated;
grant execute on function public.attribute_match_to_groups(uuid, text) to service_role;

-- ────────────────────────────────────────────────────────────
-- Trigger: dispara automatic attribution cuando match → 'confirmed'.
-- AFTER UPDATE para que la fila ya esté commit-ready y el SELECT
-- de match_players vea los datos correctos.
-- ────────────────────────────────────────────────────────────

create or replace function public.trg_match_confirmed_attribute()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'confirmed' and (old.status is distinct from 'confirmed') then
    perform public.attribute_match_to_groups(new.id, 'automatic');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attribute_match_on_confirmed on public.matches;

create trigger trg_attribute_match_on_confirmed
  after update on public.matches
  for each row
  when (new.status = 'confirmed' and (old.status is distinct from 'confirmed'))
  execute function public.trg_match_confirmed_attribute();

comment on function public.trg_match_confirmed_attribute() is
  'Dispara attribute_match_to_groups cuando un match pasa a confirmed. Fase C+D #3.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Trigger existe y está enabled:
--      SELECT tgname, tgenabled FROM pg_trigger
--       WHERE tgname = 'trg_attribute_match_on_confirmed';
--    Esperado: 1 fila, tgenabled='O' (origin enabled).
--
-- 2. Función existe:
--      SELECT proname FROM pg_proc WHERE proname = 'attribute_match_to_groups';
--    Esperado: 1 fila.
--
-- 3. Test smoke: confirmar un match cuyos 4 jugadores son miembros activos
--    de un grupo G → SELECT * FROM group_match_attributions WHERE match_id = M
--    devuelve 1 fila con attribution_type='automatic'.
-- ============================================================
