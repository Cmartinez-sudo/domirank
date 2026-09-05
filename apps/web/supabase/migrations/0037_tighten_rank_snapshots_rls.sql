-- ============================================================
-- 0037 — Apretar RLS en tournament_rank_snapshots (SECURITY_AUDIT M1)
-- ============================================================
-- Migration 0020 dejó:
--   create policy rank_snap_read_all
--     on public.tournament_rank_snapshots for select using (true);
--
-- Eso permite a cualquier usuario autenticado leer snapshots de
-- TODOS los torneos, incluso los privados o con join code. Es info
-- disclosure: rankings + user_ids + timestamps de torneos privados.
--
-- Nueva policy: leer solo snapshots de torneos donde el caller
--   (a) es el organizador,
--   (b) está inscrito como jugador,
--   o (c) el torneo es visibility = 'public'.
--
-- Idempotente: DROP IF EXISTS + CREATE.
-- ============================================================

drop policy if exists rank_snap_read_all          on public.tournament_rank_snapshots;
drop policy if exists rank_snap_read_participants on public.tournament_rank_snapshots;

create policy rank_snap_read_participants
  on public.tournament_rank_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.tournaments t
       where t.id = tournament_rank_snapshots.tournament_id
         and (
           t.visibility = 'public'
           or t.created_by = auth.uid()
           or exists (
             select 1 from public.tournament_players tp
              where tp.tournament_id = t.id
                and tp.user_id = auth.uid()
           )
         )
    )
  );

-- ============================================================
-- Verificación post-migración:
--   select polname, pg_get_expr(polqual, polrelid)
--     from pg_policy
--    where polrelid = 'public.tournament_rank_snapshots'::regclass;
--   -- debe mostrar la nueva expresión con tournaments + tournament_players
--
-- Test manual:
--   - Usuario A crea torneo privado con join code, juega algunas partidas.
--   - Snapshot generado.
--   - Usuario B (no inscrito, no organizador) hace
--       select * from tournament_rank_snapshots
--        where tournament_id = '<private-id>';
--     -> debe devolver 0 filas.
-- ============================================================
