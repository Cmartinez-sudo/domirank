-- ============================================================
-- 0038 — Revocar auto_confirm_stale_matches a authenticated (SECURITY_AUDIT M2)
-- ============================================================
-- Migrations 0016:499 y 0022:144 hicieron:
--   grant execute on function public.auto_confirm_stale_matches() to authenticated;
--
-- Eso permite a cualquier usuario logueado disparar la función. Aunque
-- la función es SECURITY DEFINER y filtra correctamente las partidas
-- elegibles (sólo las stales sin disputa), su propósito es ejecutarse
-- desde un cron programado, no on-demand. Permitir su ejecución
-- arbitraria habilita:
--   - DoS / abuse: spamming la función para forzar locks en matches.
--   - Race conditions con disputas en proceso (el filtro lee snapshot,
--     un dispute creado entre el SELECT y el UPDATE queda enmascarado).
--
-- Fix: revocar a authenticated y anon. service_role conserva execute
-- para el cron de Supabase.
-- ============================================================

revoke execute on function public.auto_confirm_stale_matches() from authenticated;
revoke execute on function public.auto_confirm_stale_matches() from anon;
revoke execute on function public.auto_confirm_stale_matches() from public;

-- Re-confirmar service_role (no-op si ya estaba, defensivo).
grant execute on function public.auto_confirm_stale_matches() to service_role;

-- ============================================================
-- Verificación post-migración:
--   select grantee, privilege_type
--     from information_schema.role_routine_grants
--    where routine_name = 'auto_confirm_stale_matches'
--      and routine_schema = 'public';
--   -- sólo service_role debe aparecer con EXECUTE.
-- ============================================================
