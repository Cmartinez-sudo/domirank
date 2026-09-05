-- ============================================================
-- 0068 — One-shot cleanup of zombie in_progress matches
-- ============================================================
-- Sprint Match Cancellation — F5.
--
-- Cancela todas las partidas en status='in_progress' sin actividad
-- > 48h (o sin updated_at registrado, que es proxy de legacy).
-- Reason: 'migration_cleanup'. Sin undo (es sistémica).
--
-- Audit log poblado para cada match cancelado.
--
-- Idempotente: re-aplicar no daña — el WHERE filtra solo zombies
-- restantes (las ya cancelladas en runs previos no califican).
-- ============================================================

do $$
declare
  v_count int;
begin
  with zombies as (
    update public.matches
       set status                  = 'cancelled',
           cancelled_at            = now(),
           cancellation_reason     = 'migration_cleanup',
           cancellation_undo_until = null,  -- sistémica, no undoable
           cancelled_by_user_id    = null
     where status = 'in_progress'
       and (
         updated_at is null
         or updated_at < now() - interval '48 hours'
         -- Fallback by created_at for matches sin updated_at populated
         or (updated_at = created_at and created_at < now() - interval '48 hours')
       )
     returning id
  ),
  audited as (
    insert into public.match_cancellation_events (match_id, action, reason)
    select id, 'cancelled', 'migration_cleanup' from zombies
    returning 1
  )
  select count(*) into v_count from audited;

  raise notice 'MC5 zombie cleanup: cancelled % stale in_progress matches', v_count;
end$$;

-- ============================================================
-- VERIFICACIÓN POST-RUN
-- ============================================================
-- 1. Count restante de zombies (debería ser 0 si no hay nuevas):
--      select count(*) from public.matches
--       where status='in_progress'
--         and (updated_at is null
--              or updated_at < now() - interval '48 hours');
--
-- 2. Audit trail:
--      select count(*) from public.match_cancellation_events
--       where reason='migration_cleanup';
-- ============================================================
