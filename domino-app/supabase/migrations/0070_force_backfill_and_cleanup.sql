-- ============================================================
-- 0070 — Force backfill matches.updated_at + re-run zombie cleanup
-- ============================================================
-- Sprint Match Cancellation — second-attempt fix.
--
-- 0069 tenía un WHERE demasiado restrictivo (updated_at IS NULL
-- or = created_at or < created_at). Después de 0066, todas las
-- matches existentes tenían updated_at = momento de la migración,
-- que es NOT NULL, NOT igual a created_at, y NOT menor. → backfill
-- no aplicó.
--
-- Esta migración hace el backfill SIN WHERE (todas las matches
-- existentes reciben updated_at calculado desde su actividad real)
-- y luego re-ejecuta el zombie cleanup.
--
-- Después de esta migración:
--   • Cada match.updated_at refleja su última actividad real.
--   • El cron de auto-cleanup detecta zombies correctamente.
--   • Las matches in_progress sin actividad > 48h pasan a cancelled.
-- ============================================================

update public.matches m
   set updated_at = greatest(
         coalesce(m.finished_at,    m.created_at),
         coalesce(m.confirmed_at,   m.created_at),
         coalesce(m.finalized_at,   m.created_at),
         coalesce(m.cancelled_at,   m.created_at),
         coalesce(
           (select max(r.created_at) from public.match_rounds r where r.match_id = m.id),
           m.created_at
         )
       );

-- Now zombie cleanup with realistic timestamps.
do $$
declare
  v_count int;
begin
  with zombies as (
    update public.matches
       set status                  = 'cancelled',
           cancelled_at            = now(),
           cancellation_reason     = 'migration_cleanup',
           cancellation_undo_until = null,
           cancelled_by_user_id    = null
     where status = 'in_progress'
       and updated_at < now() - interval '48 hours'
     returning id
  ),
  audited as (
    insert into public.match_cancellation_events (match_id, action, reason)
    select id, 'cancelled', 'migration_cleanup' from zombies
    returning 1
  )
  select count(*) into v_count from audited;

  raise notice 'MC5 zombie cleanup (forced backfill): cancelled % stale in_progress matches', v_count;
end$$;
