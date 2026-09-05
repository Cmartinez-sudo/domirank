-- ============================================================
-- 0098 — Helper RPC: get_user_id_by_email (email → auth.users.id)
-- ============================================================
-- Reemplaza el patrón anterior en claim-actions.ts:
--   await service.auth.admin.listUsers()
--     .then(({data}) => data.users.find(u => u.email === email))
-- que sufría un bug de correctness: listUsers() sin paginación devuelve
-- solo la primera página (default 50). Con ≥ 50 users existentes,
-- un claim de invitation buscando reusar cuenta previa fallaría en
-- encontrarla → intento de INSERT en auth.users con email duplicado →
-- claim rechazado.
--
-- Esta función hace lookup O(1) por email (índice único en auth.users).
--
-- Seguridad:
--   • SECURITY DEFINER: la función corre como owner (postgres), lo que
--     le da acceso a auth.users. Sin esto, service_role puede leer pero
--     el patrón RPC-tipado + fixed-shape es más auditable.
--   • SET search_path = '': hardening contra function-search-path
--     attacks (usar nombres schema-qualified en la function body).
--   • REVOKE EXECUTE FROM anon, authenticated: solo service_role puede
--     invocar. Un cliente normal no puede enumerar emails.
--   • Comparación case-insensitive con lower() para matcheo consistente
--     con el patrón `.email.toLowerCase()` en el código.
--
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;
$$;

-- Denegar por default a todos, luego habilitar solo service_role.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

COMMENT ON FUNCTION public.get_user_id_by_email(text) IS
  'Lookup O(1) de auth.users.id por email (case-insensitive). '
  'Reemplaza listUsers() paginado en el claim flow. '
  'Solo service_role puede invocar — anon/authenticated no pueden '
  'enumerar emails registrados.';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Función existe y solo service_role tiene EXECUTE:
--      SELECT proname, prosecdef,
--             array_agg(privilege_type) FILTER (WHERE grantee = 'service_role') AS svc,
--             array_agg(privilege_type) FILTER (WHERE grantee = 'anon') AS anon_priv
--        FROM pg_proc p
--        JOIN information_schema.role_routine_grants g
--          ON g.routine_name = p.proname
--       WHERE p.proname = 'get_user_id_by_email'
--       GROUP BY proname, prosecdef;
--    Esperado: prosecdef=true, svc={EXECUTE}, anon_priv=NULL.
--
-- 2. Como service_role, SELECT get_user_id_by_email('carlos@example.com')
--    → devuelve UUID si existe, NULL si no.
--
-- 3. Como anon (via SDK), rpc('get_user_id_by_email', {p_email: ...})
--    → error de permisos, no expone datos.
-- ============================================================
