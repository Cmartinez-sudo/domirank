-- ============================================================
-- 0079 — Club Pro: columnas ghost en profiles
-- ============================================================
-- Cuarta migración del feature Club Pro (Phase 1 — Schema & RLS).
--
-- Modificación ADDITIVE a public.profiles:
--   • is_ghost boolean DEFAULT false
--       → true si el perfil fue creado por el sistema de invitaciones
--         (no por un usuario real). Se actualiza a false al "claimear".
--   • claim_token text UNIQUE
--       → token secreto para activar la cuenta desde el email de invitación.
--         SENSIBLE: nunca exponer en queries públicas. El trigger
--         handle_new_user NO establece este campo — lo setea la edge function
--         send-tournament-invitation DESPUÉS de crear el user.
--   • claimed_at timestamptz
--       → cuándo el ghost activó su cuenta. NULL si aún no lo hizo.
--   • ghost_created_by_tournament_id uuid → FK a org_tournaments
--       → para saber qué torneo generó este ghost (útil para cleanup).
--
-- INTERACCIÓN CON FLOWS EXISTENTES:
--
--   1. handle_new_user trigger (mig 0001):
--      Sigue funcionando sin cambios. Para ghost users, el trigger crea
--      un profile con is_ghost=false, luego la edge function hace:
--        UPDATE profiles SET is_ghost=true, claim_token=<token>,
--               ghost_created_by_tournament_id=<id>
--        WHERE id = <ghost_user_id>
--      El trigger no conoce ni necesita conocer is_ghost.
--
--   2. profiles_read_all USING (true):
--      Los ghost profiles son visibles a cualquier usuario autenticado.
--      Esto es INTENCIONAL para que el admin de la org pueda buscar perfiles.
--
--      ATAQUE PREVENIDO: sin protección column-level, un attacker authenticated
--      podría hacer `SELECT claim_token FROM profiles WHERE is_ghost AND
--      claimed_at IS NULL` y robar los tokens pendientes → account takeover
--      del ghost antes que el invitado legítimo abra el email.
--
--      DEFENSA: REVOKE SELECT (claim_token) a roles públicos (al final de la
--      migración). Postgres bloquea la columna a nivel del motor.
--      • Queries con columnas explícitas (la convención del repo, verificado:
--        cero `.select('*')` sobre profiles en src/) NUNCA piden claim_token,
--        así que NO se afectan.
--      • Un eventual `SELECT *` futuro fallaría con "permission denied for
--        column claim_token" — esto es POR DISEÑO (fail-loud).
--      • service_role bypasea GRANTs — la edge function
--        send-tournament-invitation y el server action /claim/[token] siguen
--        leyendo el token sin problema.
--
--   3. Leaderboard (is_rated = true):
--      Los ghost users tienen 0 partidas confirmadas, por lo que
--      is_rated (GENERATED desde games count) será false.
--      Ya están excluidos del leaderboard por design — no hace falta
--      un filtro adicional. Coexistencia safe.
--
--   4. profiles_update_own (auth.uid() = id):
--      Ghost users con cuenta activa (después de claim) pueden editar
--      su propio perfil como cualquier usuario normal. Correcto.
--
-- Dependencias: 0077 (org_tournaments FK). No modifica RLS existente.
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_ghost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ghost_created_by_tournament_id uuid
    REFERENCES public.org_tournaments(id) ON DELETE SET NULL;

-- claim_token debe ser único globalmente (dos ghosts no pueden tener el mismo token).
-- NULL values no compiten entre sí en un UNIQUE constraint de Postgres.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_claim_token_unique;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_claim_token_unique UNIQUE (claim_token);

-- Índice parcial — solo filas ghost (pocos registros, búsqueda eficiente).
CREATE INDEX IF NOT EXISTS idx_profiles_ghost
  ON public.profiles(is_ghost)
  WHERE is_ghost = true;

-- Comentarios documentación.
COMMENT ON COLUMN public.profiles.is_ghost IS
  'true si este perfil fue creado por la edge function send-tournament-invitation. Se pone a false cuando el usuario completa el claim flow. Ghost users tienen is_rated=false por diseño (0 partidas confirmadas).';

COMMENT ON COLUMN public.profiles.claim_token IS
  'Token secreto único para el link de activación: /claim/{token}. SENSIBLE — column-level GRANT revoca SELECT a anon/authenticated; solo service_role puede leer. NULL para usuarios normales. Limpiado (set NULL) después del claim.';

-- ============================================================
-- HARDENING column-level: bloquea SELECT de claim_token a roles públicos
-- ============================================================
-- profiles_read_all es USING (true) por diseño (perfiles públicos).
-- Pero RLS opera a nivel de fila, no de columna — sin este REVOKE,
-- cualquier user authenticated puede SELECT claim_token y robar
-- tokens de claim pendientes.
--
-- service_role NO está afectado (bypasea GRANTs igual que RLS) —
-- la edge function send-tournament-invitation y el server action
-- /claim/[token] siguen leyendo el token sin problema.
--
-- Idempotente: REVOKE no falla si el privilegio ya no está concedido.
-- ============================================================

REVOKE SELECT (claim_token) ON public.profiles FROM anon, authenticated;

COMMENT ON COLUMN public.profiles.claimed_at IS
  'Timestamp cuando el ghost user activó su cuenta via /claim/{token}. NULL si es un usuario normal o si el ghost aún no activó.';

COMMENT ON COLUMN public.profiles.ghost_created_by_tournament_id IS
  'FK al org_tournament que originó este ghost. Útil para cleanup si el torneo se cancela. NULL para usuarios normales.';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Columnas existen:
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='profiles'
--         AND column_name IN ('is_ghost','claim_token','claimed_at',
--                             'ghost_created_by_tournament_id')
--       ORDER BY column_name;
--    Esperado: 4 filas. is_ghost: boolean NOT NULL default false.
--
-- 2. claim_token UNIQUE:
--    UPDATE dos profiles con claim_token='abc' → segundo falla.
--
-- 3. Perfiles existentes no afectados:
--    SELECT count(*) FROM profiles WHERE is_ghost = true;
--    Esperado: 0 (ningún user existente es ghost).
--
-- 4. is_rated sigue funcionando (GENERATED columna no tocada):
--    SELECT count(*) FROM profiles WHERE is_rated = true;
--    Esperado: mismo número que antes de la migración.
--
-- 5. Ghost profile no aparece en leaderboard:
--    Un profile con is_ghost=true tiene 0 games → is_rated=false →
--    no aparece en la query del leaderboard (filtra is_rated=true).
--
-- 6. claim_token NO es legible por anon/authenticated:
--      SET ROLE authenticated;
--      SELECT claim_token FROM public.profiles LIMIT 1;
--    Esperado: ERROR "permission denied for column claim_token".
--      SELECT id, username FROM public.profiles LIMIT 1;
--    Esperado: ÉXITO (no toca la columna revocada).
--    Como service_role:
--      SET ROLE service_role;
--      SELECT claim_token FROM public.profiles LIMIT 1;
--    Esperado: ÉXITO (service_role bypasea GRANTs).
-- ============================================================
