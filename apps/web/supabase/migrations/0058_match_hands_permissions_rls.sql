-- ============================================================
-- 0058 — Permission functions + RLS para match_rounds (manos)
-- ============================================================
-- Sprint Active Match Awareness — C2.
--
-- Permission model:
--   • can_record_hand(match_id, user_id) → boolean
--     true si user_id es el active score-keeper del match.
--   • can_edit_hand(round_id, user_id) → table(allowed bool, reason text)
--     Reglas:
--       - Autor de la mano + ventana < 5min → directo, reason='author_within_window'
--       - Creator del match → directo siempre, reason='host_override'
--       - Otros → false, reason='requires_attestation' (UI dispara mini-flow)
--
-- RLS:
--   • INSERT en match_rounds: solo el current score-keeper del match.
--   • UPDATE en match_rounds: solo si can_edit_hand devuelve allowed=true.
--   • DELETE: igual que UPDATE.
--   • SELECT: ya cubierto (read all) + se mantiene.
--
-- Dependencias: 0057 (match_score_keepers).
-- ============================================================

-- 1. can_record_hand — checks score-keeper status.
create or replace function public.can_record_hand(
  p_match_id uuid,
  p_user_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_score_keepers
     where match_id = p_match_id
       and user_id = p_user_id
       and active = true
  )
$$;

comment on function public.can_record_hand(uuid, uuid) is
  'Returns true if the given user is the current active score-keeper for the match.';

grant execute on function public.can_record_hand(uuid, uuid) to authenticated;

-- 2. can_edit_hand — returns (allowed, reason) per spec.
create or replace function public.can_edit_hand(
  p_round_id bigint,
  p_user_id uuid
) returns table(allowed boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_round    public.match_rounds%rowtype;
  v_match    public.matches%rowtype;
  v_is_creator   boolean;
  v_is_author    boolean;
  v_within_5min  boolean;
begin
  select * into v_round from public.match_rounds where id = p_round_id;
  if not found then
    return query select false, 'round_not_found'::text;
    return;
  end if;

  select * into v_match from public.matches where id = v_round.match_id;
  if not found then
    return query select false, 'match_not_found'::text;
    return;
  end if;

  -- Solo se puede editar mientras la partida está in_progress.
  -- (Post-confirm el rating ya se aplicó; cambios requieren admin tool.)
  if v_match.status <> 'in_progress' then
    return query select false, 'match_not_in_progress'::text;
    return;
  end if;

  v_is_creator  := (v_match.created_by = p_user_id);
  v_is_author   := (v_round.recorded_by_user_id = p_user_id);
  v_within_5min := (now() - v_round.recorded_at < interval '5 minutes');

  if v_is_author and v_within_5min then
    return query select true, 'author_within_window'::text;
  elsif v_is_creator then
    return query select true, 'host_override'::text;
  else
    return query select false, 'requires_attestation'::text;
  end if;
end;
$$;

comment on function public.can_edit_hand(bigint, uuid) is
  'Returns (allowed, reason) tuple. Reasons: author_within_window, host_override, requires_attestation, match_not_in_progress, round_not_found, match_not_found.';

grant execute on function public.can_edit_hand(bigint, uuid) to authenticated;

-- 3. Reescribir RLS de match_rounds.
--    Drop policies viejas y crear las nuevas basadas en can_record_hand.
--    El SELECT policy (read all) se mantiene.

drop policy if exists match_rounds_insert_creator on public.match_rounds;
drop policy if exists match_rounds_delete_creator on public.match_rounds;
drop policy if exists match_rounds_update_authorized on public.match_rounds;

-- INSERT: solo el current score-keeper. recorded_by_user_id debe ser auth.uid().
create policy match_rounds_insert_score_keeper
  on public.match_rounds for insert
  with check (
    public.can_record_hand(match_id, auth.uid())
    and (recorded_by_user_id is null or recorded_by_user_id = auth.uid())
  );

-- UPDATE: usa can_edit_hand.
create policy match_rounds_update_authorized
  on public.match_rounds for update
  using (
    (select allowed from public.can_edit_hand(id, auth.uid()))
  )
  with check (
    (select allowed from public.can_edit_hand(id, auth.uid()))
  );

-- DELETE: solo el creator del match (host override).
-- (Es destructivo — preferimos UPDATE con edit_count que DELETE.)
create policy match_rounds_delete_creator
  on public.match_rounds for delete
  using (
    exists (
      select 1 from public.matches m
       where m.id = match_id
         and m.created_by = auth.uid()
         and m.status = 'in_progress'
    )
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Functions exist:
--      select proname from pg_proc
--       where pronamespace = 'public'::regnamespace
--         and proname in ('can_record_hand','can_edit_hand');
--    Esperado: 2 filas.
--
-- 2. Policies renombradas:
--      select polname from pg_policy
--       where polrelid = 'public.match_rounds'::regclass;
--    Esperado: match_rounds_read_all + match_rounds_insert_score_keeper
--    + match_rounds_update_authorized + match_rounds_delete_creator.
--
-- 3. Smoke test can_edit_hand:
--      select * from public.can_edit_hand(
--        (select id from match_rounds order by created_at desc limit 1),
--        (select created_by from matches order by created_at desc limit 1)
--      );
--    Esperado: 1 fila con allowed + reason válidos.
-- ============================================================
