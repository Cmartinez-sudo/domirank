-- ============================================================
-- 0069 — Backfill matches.updated_at from real activity timestamps
-- ============================================================
-- Sprint Match Cancellation — fix post-MC1.
--
-- Problema: la migración 0066 añadió matches.updated_at con
-- `default now()`, lo que dejó a TODAS las matches existentes con
-- updated_at = momento de la migración (fresh). Eso oculta zombies
-- legítimos del cron auto-cleanup y del oneshot 0068.
--
-- Fix: backfill updated_at = max(timestamps reales del match):
--   coalesce(finished_at, confirmed_at, finalized_at,
--            cancelled_at, max(match_rounds.created_at), created_at)
--
-- Después de esto, las matches sin actividad reciente quedan con
-- updated_at < now() - 48h y el cron las detecta.
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
       )
 where updated_at is null
    or updated_at = created_at -- defaulted, not actually populated
    or updated_at < created_at; -- safety

-- Re-run zombie cleanup ahora que updated_at refleja realidad.
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

  raise notice 'MC5 zombie cleanup (post-backfill): cancelled % stale in_progress matches', v_count;
end$$;
