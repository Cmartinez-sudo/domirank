-- ============================================================
-- 0059 — Single active match per user + active_matches_per_user view
-- ============================================================
-- Sprint Active Match Awareness — C3.
--
-- Garantiza que un usuario solo puede tener UNA partida activa
-- ('in_progress' | 'pending_attestation') a la vez. Enforcement
-- a nivel DB via trigger en match_players.
--
-- Vista `active_matches_per_user`:
--   Query rápida: dado un user, ¿en qué match activo está? Usada por
--   useActiveMatch hook (C7) y smart-redirect.
--
-- Backfill diagnóstico:
--   El spec dice "no auto-void" para legacy. Solo RAISE NOTICE con
--   conteo de users con múltiples partidas activas. Si hay conflictos,
--   requiere cleanup manual antes de aplicar el trigger en prod.
--
-- Dependencias: matches, match_players (mig 0001).
-- ============================================================

-- 1. Vista active_matches_per_user.
--    Una fila por (user_id, match_id) donde el match esté activo.
--    Bajo el constraint del trigger esto será 0 o 1 fila por user.

create or replace view public.active_matches_per_user as
select
  mp.user_id,
  m.id as match_id,
  m.status,
  m.created_at,
  m.format,
  m.target_points,
  m.created_by,
  m.scorekeeper_id as current_score_keeper_id,
  m.tournament_id
from public.match_players mp
join public.matches m on m.id = mp.match_id
where m.status in ('in_progress', 'pending_attestation');

grant select on public.active_matches_per_user to authenticated;

comment on view public.active_matches_per_user is
  'Una fila por (user_id, match_id) cuando el match está in_progress o pending_attestation. Bajo el trigger trg_one_active_match, máximo 1 fila por user. Usado por useActiveMatch hook.';

-- 2. Diagnóstico pre-trigger: detectar users con múltiples partidas activas.
--    Si hay conflictos, el trigger fallará al primer INSERT que violaría.
--    Reportamos a NOTICE; admin debe correr cleanup manual.

do $$
declare
  v_conflicts int;
begin
  select count(*) into v_conflicts
    from (
      select user_id, count(*) as n
        from public.active_matches_per_user
       group by user_id
      having count(*) > 1
    ) c;

  if v_conflicts > 0 then
    raise warning '% users with multiple active matches detected. Cleanup recommended before relying on the single-active-match invariant.', v_conflicts;
  else
    raise notice 'Single-active-match invariant clean: 0 users with conflicts.';
  end if;
end$$;

-- 3. Trigger function: enforce single active match per user.
--    Before INSERT en match_players, verificar que el user no esté ya
--    en otro match activo (distinto del que se está insertando).

create or replace function public.enforce_one_active_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_match_id uuid;
  v_new_match_active boolean;
begin
  -- Solo enforce si el match al que se está añadiendo es activo.
  -- (Insertar players a matches confirmed/void/cancelled no triggerea.)
  select (status in ('in_progress','pending_attestation'))
    into v_new_match_active
    from public.matches where id = new.match_id;

  if not coalesce(v_new_match_active, false) then
    return new;
  end if;

  -- ¿El user ya está en otro match activo?
  select match_id into v_existing_match_id
    from public.active_matches_per_user
   where user_id = new.user_id
     and match_id <> new.match_id
   limit 1;

  if v_existing_match_id is not null then
    raise exception 'User % already has an active match (%). Finish or cancel it before joining a new one.',
      new.user_id, v_existing_match_id
      using errcode = 'P0001', hint = 'Cancel or finalize the existing match first.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_one_active_match() is
  'Trigger fn: blocks INSERT into match_players if the user is already in another active (in_progress | pending_attestation) match.';

drop trigger if exists trg_one_active_match on public.match_players;

create trigger trg_one_active_match
  before insert on public.match_players
  for each row
  execute function public.enforce_one_active_match();

comment on trigger trg_one_active_match on public.match_players is
  'Sprint Active Match Awareness: 1 partida activa por user (C3).';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. View exists + retorna 0 ó 1 fila por user (post-trigger):
--      select user_id, count(*) from public.active_matches_per_user
--       group by user_id having count(*) > 1;
--    Esperado: 0 filas.
--
-- 2. Trigger blocks duplicate active match (smoke test):
--      Intentar INSERT a match_players con un user que ya está en
--      otro match in_progress. Debe fallar con
--      'User X already has an active match'.
--
-- 3. Trigger NO bloquea inserts a matches no-activos:
--      Insertar match_player a un match status='confirmed'. Pass.
-- ============================================================
