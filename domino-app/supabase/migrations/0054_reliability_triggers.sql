-- ============================================================
-- 0054 — Reliability triggers on matches.status transitions
-- ============================================================
-- Sprint Reliability NR — F1.3 del RELIABILITY_NR_HOW_IT_WORKS.md.
--
-- Trigger AFTER UPDATE OF status ON matches que recomputa reliability
-- para todos los match_players cuando el match transiciona a/desde
-- 'confirmed'.
--
-- Casos cubiertos:
--   • in_progress/pending_attestation → confirmed  (attested ↑)
--   • confirmed → disputed/void                    (attested ↓)
--   • disputed → confirmed                         (re-promoción)
--
-- Diseño:
--   • Fires AFTER UPDATE — el row final ya está escrito.
--   • WHEN clause filtra solo transiciones relevantes (no UPDATEs de
--     score/notes/etc). Reduce overhead drásticamente.
--   • SECURITY DEFINER — update_player_reliability escribe en profiles
--     y el caller (auth user via RLS) no necesariamente tiene perms
--     directos. Compute funciona con el search_path fijo a public.
--   • Loop por match_players (no INSERT al mismo match) → cero riesgo
--     de recursión infinita.
--   • PERFORM (no SELECT INTO) — descartamos el return value del
--     compute, solo nos importa el side effect del UPDATE en profiles.
--
-- Trade-off: cada match confirmado dispara 2-4 UPDATEs en profiles
-- (singles=2, doubles=4). Para 1000 matches/día son 2-4k UPDATEs,
-- aceptable. El cron nightly (0055) re-asegura consistency.
--
-- Dependencias: 0053 (update_player_reliability existe).
-- ============================================================

create or replace function public.tg_recompute_reliability_on_match_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Solo procesar si la transición involucra 'confirmed' en uno u otro lado.
  -- (El WHEN del trigger ya lo filtra, pero defensivo dentro del body.)
  if (new.status is distinct from old.status)
     and ('confirmed' in (old.status, new.status))
  then
    for v_user_id in
      select user_id from public.match_players where match_id = new.id
    loop
      perform public.update_player_reliability(v_user_id);
    end loop;
  end if;

  return new;
end;
$$;

comment on function public.tg_recompute_reliability_on_match_status() is
  'Trigger fn: recomputa reliability para los participantes cuando un match entra o sale de status=confirmed. Usado por trg_reliability_on_match_status.';

-- Borrar trigger anterior si existía (idempotente).
drop trigger if exists trg_reliability_on_match_status on public.matches;

create trigger trg_reliability_on_match_status
  after update of status on public.matches
  for each row
  when (old.status is distinct from new.status
        and ('confirmed' in (old.status, new.status)))
  execute function public.tg_recompute_reliability_on_match_status();

comment on trigger trg_reliability_on_match_status on public.matches is
  'Recomputa reliability_score de cada participante cuando match.status cruza el umbral de confirmed. Spec: RELIABILITY_NR_HOW_IT_WORKS.md F1.3.';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Trigger existe en pg_trigger:
--      select tgname, tgrelid::regclass, tgenabled
--        from pg_trigger where tgname = 'trg_reliability_on_match_status';
--    Esperado: 1 fila, tgenabled='O' (origin = enabled).
--
-- 2. Trigger function existe:
--      select proname from pg_proc
--       where proname = 'tg_recompute_reliability_on_match_status';
--    Esperado: 1 fila.
--
-- 3. Smoke test end-to-end (escoge un match real en pending_attestation):
--      -- before:
--      select reliability_score, reliability_updated_at from profiles
--       where id in (select user_id from match_players where match_id='<id>');
--      -- transición:
--      update matches set status='confirmed' where id='<id>';
--      -- after:
--      select reliability_score, reliability_updated_at from profiles
--       where id in (select user_id from match_players where match_id='<id>');
--    Esperado: reliability_updated_at se movió a now() para los N participantes.
--
-- 4. Trigger NO fires en UPDATEs irrelevantes:
--      update matches set notes='foo' where id='<id>';
--      -- reliability_updated_at NO debe cambiar.
-- ============================================================
