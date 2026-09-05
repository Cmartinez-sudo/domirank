-- ============================================================
-- 0071 — Backfill updated_at bypassing the touch trigger
-- ============================================================
-- Sprint Match Cancellation — third (and final) backfill attempt.
--
-- Issue: el trigger trg_matches_touch_updated_at (0066) fire BEFORE
-- UPDATE y setea new.updated_at = now(), pisando cualquier valor que
-- el backfill quisiera asignar. Por eso 0069 y 0070 dejaron todas
-- las matches con updated_at = momento de la migración.
--
-- Solución: ALTER TABLE DISABLE TRIGGER → backfill → ALTER TABLE
-- ENABLE TRIGGER. Atomic en una sola sesión.
-- ============================================================

alter table public.matches disable trigger trg_matches_touch_updated_at;

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

alter table public.matches enable trigger trg_matches_touch_updated_at;

-- Ahora sí el zombie cleanup ve los timestamps reales.
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

  raise notice 'MC5 zombie cleanup (trigger bypass): cancelled % stale in_progress matches', v_count;
end$$;
