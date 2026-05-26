-- ============================================================
-- 0035 — Fix TOCTOU race en accept_pair_invite (SECURITY_AUDIT H6)
-- ============================================================
-- Idempotente: usa CREATE OR REPLACE FUNCTION.
-- Requisito previo: 0031_epic_r_fixes.sql ya aplicado.
--
-- Bug original (0031 líneas 75-87):
--   La función insertaba al invitee en tournament_players ANTES
--   de validar que el inviter siguiera inscrito. Si el inviter se
--   desinscribía después del check, el invite quedaba aceptado
--   apuntando a un inviter ausente; en otra ordenación, el pair
--   se creaba sin que ambos jugadores estuviesen en el torneo.
--   `select for update` sobre pair_invites no protege contra
--   modificaciones a tournament_players en paralelo.
--
-- Fix:
--   1. Re-verificar que el invite sigue 'pending' tomando lock
--      (idem 0031).
--   2. Tomar `for update` sobre la row de tournament_players del
--      inviter. Esto bloquea cualquier delete concurrente; si la
--      row no existe, fallar aquí antes de tocar nada.
--   3. Recién entonces insertar invitee + pair.
--
-- El lock se libera al commit/rollback de la transacción, así
-- el inviter no puede salir del torneo durante el resto de la
-- función.
-- ============================================================

create or replace function public.accept_pair_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_inviter_in_tournament boolean;
begin
  -- 1. Lockear el invite mismo (idem versión anterior).
  select * into v_invite
    from public.pair_invites
   where id = p_invite_id
     and invitee_id = auth.uid()
     and status = 'pending'
   for update;

  if not found then
    raise exception 'invite_not_found_or_not_invitee';
  end if;

  -- 2. Torneo abierto.
  if not exists (
    select 1 from public.tournaments
     where id = v_invite.tournament_id
       and status = 'open'
  ) then
    raise exception 'tournament_not_open';
  end if;

  -- 3. CRÍTICO: lockear la fila del inviter ANTES de modificar nada.
  --    select 1 ... for update bloquea cualquier delete concurrente
  --    sobre esta row hasta el commit. Si la row no existe, NULL/false
  --    y abortamos sin haber tocado el estado.
  select true into v_inviter_in_tournament
    from public.tournament_players
   where tournament_id = v_invite.tournament_id
     and user_id = v_invite.inviter_id
   for update;

  if not coalesce(v_inviter_in_tournament, false) then
    raise exception 'inviter_no_longer_in_tournament';
  end if;

  -- 4. Insertar invitee como jugador del torneo (idempotente).
  insert into public.tournament_players (tournament_id, user_id)
    values (v_invite.tournament_id, v_invite.invitee_id)
    on conflict do nothing;

  -- 5. Insertar el pair con orden canónico (user_a_id < user_b_id).
  insert into public.tournament_pairs (tournament_id, user_a_id, user_b_id)
    values (
      v_invite.tournament_id,
      least(v_invite.inviter_id::text, v_invite.invitee_id::text)::uuid,
      greatest(v_invite.inviter_id::text, v_invite.invitee_id::text)::uuid
    )
    on conflict (tournament_id, user_a_id) do nothing;

  -- 6. Marcar el invite como aceptado.
  update public.pair_invites
     set status = 'accepted', responded_at = now()
   where id = p_invite_id;

  -- 7. Cancelar otros invites pending relacionados al mismo torneo.
  update public.pair_invites
     set status = 'cancelled', responded_at = now()
   where tournament_id = v_invite.tournament_id
     and status = 'pending'
     and (
       inviter_id = v_invite.inviter_id
       or invitee_id = v_invite.invitee_id
       or inviter_id = v_invite.invitee_id
       or invitee_id = v_invite.inviter_id
     )
     and id <> p_invite_id;
end;
$$;

-- ============================================================
-- PASO MANUAL POST-MIGRACIÓN
--   supabase db push
--   -- o pegar este contenido en el SQL Editor de Supabase
--
-- Verificar:
--   select pg_get_functiondef(oid)
--     from pg_proc
--    where proname = 'accept_pair_invite';
--   -- debe contener "for update" sobre tournament_players
-- ============================================================
