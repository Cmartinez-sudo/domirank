-- ============================================================
-- 0075 — Vistas a security_invoker
-- ============================================================
-- Hotfix de seguridad — resuelve los 6 ERROR del linter de Supabase:
--   "Security Definer View" en las vistas listadas abajo.
--
-- Contexto:
--   Las vistas fueron creadas en sprints previos con modo
--   SECURITY DEFINER (default heredado). En ese modo, las RLS de
--   tablas subyacentes se evalúan contra el OWNER de la vista,
--   no contra el caller — bypassando las protecciones de RLS.
--
--   PG 15+ y Supabase soportan `security_invoker = on`: hace que
--   las RLS se evalúen contra auth.uid() (el caller). No es un
--   drop+recreate — solo cambia el modo. Si las RLS subyacentes
--   son correctas, las queries siguen funcionando idénticas.
--
-- Tablas subyacentes (todas con RLS apropiada verificada):
--   • profiles                — profiles_read_all USING true
--   • matches                 — matches_read_all USING true
--   • match_players           — match_players_read_all USING true
--   • match_rounds            — match_rounds_read_participants_or_spectators
--                                (con can_spectate_match SECURITY DEFINER)
--   • tournaments             — tournaments_read_all USING true
--   • tournament_players      — tp_read_all USING true
--   • tournament_pairings     — tp_read_visible (gating por torneo)
--   • match_attestations      — RLS habilitada (mig 0016/0018)
--
-- Riesgo: BAJO. Las policies subyacentes son permisivas (read_all)
-- o ya hacen gating apropiado vía funciones SECURITY DEFINER.
--
-- Rollback (si algo se rompe en preview/prod):
--   ALTER VIEW public.<view_name> SET (security_invoker = off);
-- ============================================================

alter view public.active_matches_per_user                   set (security_invoker = on);
alter view public.match_feed                                set (security_invoker = on);
alter view public.match_live_state                          set (security_invoker = on);
alter view public.tournament_standings                      set (security_invoker = on);
alter view public.profile_ratings                           set (security_invoker = on);
alter view public.continuous_league_current_season_pairings set (security_invoker = on);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Todas las vistas en modo invoker:
--      select c.relname, c.reloptions
--        from pg_class c
--       where c.relkind = 'v'
--         and c.relname in (
--           'active_matches_per_user','match_feed','match_live_state',
--           'tournament_standings','profile_ratings',
--           'continuous_league_current_season_pairings'
--         );
--    Esperado: cada reloptions contiene 'security_invoker=on'.
--
-- 2. Smoke E2E en preview environment:
--    a) Dashboard de user X carga (active_matches_per_user, profile_ratings).
--    b) Match view carga (match_live_state) para participantes y espectadores
--       que pasan can_spectate_match.
--    c) Tournament view carga (tournament_standings).
--    d) Continuous league view carga (continuous_league_current_season_pairings).
--    e) Feed (match_feed) carga.
--    f) Cross-user check: como user A, ver match privado de user B
--       debe devolver 0 filas o 403.
--
-- 3. Linter de Supabase: los 6 errores "Security Definer View"
--    desaparecen. Re-correr `supabase db lint` o desde el dashboard.
-- ============================================================
