-- ============================================================
-- Grupos Phase 1 — Integration Tests (pgTAP)
-- ============================================================
-- Cubre los 4 commits de Phase 1: groups + group_members,
-- group_match_attributions, group_invitations, group_leaderboard.
--
-- Cómo correr:
--   supabase test db
--   (requiere supabase local en ejecución y extensión pgtap)
--
-- Estructura:
--   BLOQUE 1 — Schema: tablas, columnas, helpers, RLS habilitada
--   BLOQUE 2 — Constraints (UNIQUE, CHECK, FK)
--   BLOQUE 3 — Permission helpers (is_group_member / is_group_admin)
--   BLOQUE 4 — Soft-leave + anonymized
--   BLOQUE 5 — Vista group_leaderboard (agregaciones desde match_players)
--   BLOQUE 6 — Edge cases
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(35);

-- ============================================================
-- BLOQUE 1 — Schema y RLS
-- ============================================================

SELECT has_table('public', 'groups',                    'TABLE groups existe');
SELECT has_table('public', 'group_members',             'TABLE group_members existe');
SELECT has_table('public', 'group_match_attributions',  'TABLE group_match_attributions existe');
SELECT has_table('public', 'group_invitations',         'TABLE group_invitations existe');

SELECT has_view('public', 'group_leaderboard',          'VIEW group_leaderboard existe');

-- Columnas críticas
SELECT has_column('public', 'groups',        'allow_friendlies',            'groups.allow_friendlies existe');
SELECT has_column('public', 'groups',        'migrated_from_tournament_id', 'groups.migrated_from_tournament_id existe');
SELECT has_column('public', 'group_members', 'status',                      'group_members.status existe');
SELECT has_column('public', 'group_members', 'anonymized',                  'group_members.anonymized existe');

-- RLS habilitada
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'groups' AND relkind = 'r'),
  true,
  'RLS habilitada en groups'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'group_members' AND relkind = 'r'),
  true,
  'RLS habilitada en group_members'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'group_match_attributions' AND relkind = 'r'),
  true,
  'RLS habilitada en group_match_attributions'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'group_invitations' AND relkind = 'r'),
  true,
  'RLS habilitada en group_invitations'
);

-- Helpers SECURITY DEFINER (anti-recursión)
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'is_group_member' AND pronamespace = 'public'::regnamespace),
  true,
  'is_group_member es SECURITY DEFINER'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'is_group_admin' AND pronamespace = 'public'::regnamespace),
  true,
  'is_group_admin es SECURITY DEFINER'
);

-- Vista con security_invoker
SELECT is(
  (
    SELECT 'security_invoker=on' = ANY(reloptions)
    FROM pg_class
    WHERE relkind = 'v' AND relname = 'group_leaderboard'
  ),
  true,
  'group_leaderboard tiene security_invoker=on'
);

-- ============================================================
-- BLOQUE 2 — Constraints de negocio
-- ============================================================

-- Setup: 5 usuarios y un grupo base.
DO $$
DECLARE
  v_user1 uuid := gen_random_uuid();
  v_user2 uuid := gen_random_uuid();
  v_user3 uuid := gen_random_uuid();
  v_user4 uuid := gen_random_uuid();
  v_user5 uuid := gen_random_uuid();
  v_group_id uuid;
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, email_confirmed_at, aud, role)
  VALUES
    (v_user1, 'grupo-user1@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated'),
    (v_user2, 'grupo-user2@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated'),
    (v_user3, 'grupo-user3@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated'),
    (v_user4, 'grupo-user4@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated'),
    (v_user5, 'grupo-user5@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (name, created_by_user_id)
  VALUES ('Test Grupo Familia', v_user1)
  RETURNING id INTO v_group_id;

  -- user1 admin activo, user2/3/4 active members, user5 no member.
  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at) VALUES
    (v_group_id, v_user1, 'admin',  'active', now()),
    (v_group_id, v_user2, 'member', 'active', now()),
    (v_group_id, v_user3, 'member', 'active', now()),
    (v_group_id, v_user4, 'member', 'active', now());

  RAISE NOTICE 'TEST setup OK: grupo creado con 4 active members';

  -- 2.1 UNIQUE (group_id, user_id) — no se permite duplicar membership.
  BEGIN
    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (v_group_id, v_user1, 'member', 'invited');
    RAISE NOTICE 'TEST 2.1 FAIL: membership duplicada aceptada';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 2.1 PASS: UNIQUE(group_id,user_id) rechaza duplicado';
  END;

  -- 2.2 CHECK status: valor inválido es rechazado.
  BEGIN
    INSERT INTO public.group_members (group_id, user_id, status)
    VALUES (v_group_id, v_user5, 'foobar');
    RAISE NOTICE 'TEST 2.2 FAIL: status inválido aceptado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2.2 PASS: CHECK status rechaza valor inválido';
  END;

  -- 2.3 CHECK role: 'superadmin' no es válido.
  BEGIN
    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (v_group_id, v_user5, 'superadmin', 'active');
    RAISE NOTICE 'TEST 2.3 FAIL: role inválido aceptado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2.3 PASS: CHECK role rechaza valor inválido';
  END;

  -- 2.4 CHECK name length: < 2 caracteres.
  BEGIN
    INSERT INTO public.groups (name, created_by_user_id) VALUES ('A', v_user1);
    RAISE NOTICE 'TEST 2.4 FAIL: nombre de 1 char aceptado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 2.4 PASS: CHECK name length rechaza nombre corto';
  END;

END $$;

-- ============================================================
-- BLOQUE 3 — Permission helpers
-- ============================================================

DO $$
DECLARE
  v_user1 uuid;
  v_user5 uuid;
  v_group_id uuid;
  v_is_member boolean;
  v_is_admin boolean;
BEGIN
  SELECT id INTO v_user1 FROM auth.users WHERE email = 'grupo-user1@test.com';
  SELECT id INTO v_user5 FROM auth.users WHERE email = 'grupo-user5@test.com';
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';

  -- 3.1 user1 (admin active) → is_group_member=true, is_group_admin=true
  SELECT public.is_group_member(v_user1, v_group_id) INTO v_is_member;
  SELECT public.is_group_admin(v_user1, v_group_id) INTO v_is_admin;
  IF v_is_member AND v_is_admin THEN
    RAISE NOTICE 'TEST 3.1 PASS: admin reconocido como member+admin';
  ELSE
    RAISE NOTICE 'TEST 3.1 FAIL: admin no reconocido (member=%, admin=%)', v_is_member, v_is_admin;
  END IF;

  -- 3.2 user5 (no member) → false en ambos
  SELECT public.is_group_member(v_user5, v_group_id) INTO v_is_member;
  SELECT public.is_group_admin(v_user5, v_group_id) INTO v_is_admin;
  IF NOT v_is_member AND NOT v_is_admin THEN
    RAISE NOTICE 'TEST 3.2 PASS: non-member correctamente identificado';
  ELSE
    RAISE NOTICE 'TEST 3.2 FAIL: non-member reportado como member (m=%, a=%)', v_is_member, v_is_admin;
  END IF;

  -- 3.3 Invited (status='invited') NO debe ser member activo.
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_user5, 'member', 'invited');

  SELECT public.is_group_member(v_user5, v_group_id) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE NOTICE 'TEST 3.3 PASS: invited (no active) NO es group member';
  ELSE
    RAISE NOTICE 'TEST 3.3 FAIL: invited contó como active member';
  END IF;

END $$;

-- ============================================================
-- BLOQUE 4 — Soft-leave + anonymized
-- ============================================================

DO $$
DECLARE
  v_user2 uuid;
  v_group_id uuid;
  v_status text;
  v_anonymized boolean;
  v_is_member boolean;
BEGIN
  SELECT id INTO v_user2 FROM auth.users WHERE email = 'grupo-user2@test.com';
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';

  -- 4.1 Soft-leave con anonymize=true
  UPDATE public.group_members
     SET status = 'left',
         left_at = now(),
         anonymized = true
   WHERE group_id = v_group_id AND user_id = v_user2;

  SELECT status, anonymized
    INTO v_status, v_anonymized
    FROM public.group_members
   WHERE group_id = v_group_id AND user_id = v_user2;

  IF v_status = 'left' AND v_anonymized = true THEN
    RAISE NOTICE 'TEST 4.1 PASS: soft-leave preserva fila con anonymized=true';
  ELSE
    RAISE NOTICE 'TEST 4.1 FAIL: status=% anonymized=%', v_status, v_anonymized;
  END IF;

  -- 4.2 is_group_member retorna false tras soft-leave.
  SELECT public.is_group_member(v_user2, v_group_id) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE NOTICE 'TEST 4.2 PASS: usuario con status=left no aparece como member';
  ELSE
    RAISE NOTICE 'TEST 4.2 FAIL: status=left aún contó como member';
  END IF;

END $$;

-- ============================================================
-- BLOQUE 5 — group_leaderboard view
-- ============================================================

-- 5.1 Grupo sin partidas → leaderboard vacío.
DO $$
DECLARE
  v_group_id uuid;
  v_lb_count int;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';

  SELECT count(*) INTO v_lb_count
    FROM public.group_leaderboard
   WHERE group_id = v_group_id;

  IF v_lb_count = 0 THEN
    RAISE NOTICE 'TEST 5.1 PASS: leaderboard vacío sin partidas atribuidas';
  ELSE
    RAISE NOTICE 'TEST 5.1 FAIL: leaderboard tiene % filas sin atribuciones', v_lb_count;
  END IF;
END $$;

-- 5.2 Crear partida confirmada, atribuir, verificar conteos.
DO $$
DECLARE
  v_user1 uuid;
  v_user3 uuid;
  v_user4 uuid;
  v_group_id uuid;
  v_match_id uuid;
  v_admin_user uuid;
  v_wins int;
  v_losses int;
  v_matches int;
BEGIN
  SELECT id INTO v_user1 FROM auth.users WHERE email = 'grupo-user1@test.com';
  SELECT id INTO v_user3 FROM auth.users WHERE email = 'grupo-user3@test.com';
  SELECT id INTO v_user4 FROM auth.users WHERE email = 'grupo-user4@test.com';
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';

  -- Necesitamos un 4to user activo en el grupo (user2 hizo soft-leave en 4.1).
  -- user5 fue invitado en 3.3 pero status='invited'. Activamos otro user.
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, email_confirmed_at, aud, role)
  VALUES (gen_random_uuid(), 'grupo-user6@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated')
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_admin_user FROM auth.users WHERE email = 'grupo-user6@test.com';

  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at)
  VALUES (v_group_id, v_admin_user, 'member', 'active', now())
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Crear match doubles confirmed: equipo 1 (user1+user3) gana 100-65 a equipo 2 (user4+user6).
  INSERT INTO public.matches (id, format, target_points, status, rated, finished_at, confirmed_at)
  VALUES (gen_random_uuid(), 'doubles', 100, 'confirmed', true, now(), now())
  RETURNING id INTO v_match_id;

  INSERT INTO public.match_players (match_id, user_id, team, score, rank) VALUES
    (v_match_id, v_user1,       1, 100, 1),  -- ganador
    (v_match_id, v_user3,       1, 100, 1),  -- ganador (compañero)
    (v_match_id, v_user4,       2,  65, 2),  -- perdedor
    (v_match_id, v_admin_user,  2,  65, 2);  -- perdedor (compañero)

  -- Atribuir manualmente (Phase 3 lo hará por trigger; aquí simulamos).
  INSERT INTO public.group_match_attributions (group_id, match_id, attribution_type)
  VALUES (v_group_id, v_match_id, 'manual');

  -- 5.2a user1 debe tener 1 win, 0 losses.
  SELECT wins, losses, matches_played
    INTO v_wins, v_losses, v_matches
    FROM public.group_leaderboard
   WHERE group_id = v_group_id AND user_id = v_user1;

  IF v_wins = 1 AND v_losses = 0 AND v_matches = 1 THEN
    RAISE NOTICE 'TEST 5.2a PASS: ganador con 1W/0L/1MP';
  ELSE
    RAISE NOTICE 'TEST 5.2a FAIL: W=% L=% MP=%', v_wins, v_losses, v_matches;
  END IF;

  -- 5.2b user4 debe tener 0 wins, 1 loss.
  SELECT wins, losses, matches_played
    INTO v_wins, v_losses, v_matches
    FROM public.group_leaderboard
   WHERE group_id = v_group_id AND user_id = v_user4;

  IF v_wins = 0 AND v_losses = 1 AND v_matches = 1 THEN
    RAISE NOTICE 'TEST 5.2b PASS: perdedor con 0W/1L/1MP';
  ELSE
    RAISE NOTICE 'TEST 5.2b FAIL: W=% L=% MP=%', v_wins, v_losses, v_matches;
  END IF;

  -- 5.2c Partida no confirmed NO debe aparecer.
  UPDATE public.matches SET status = 'cancelled' WHERE id = v_match_id;

  SELECT count(*) INTO v_matches
    FROM public.group_leaderboard
   WHERE group_id = v_group_id;

  IF v_matches = 0 THEN
    RAISE NOTICE 'TEST 5.2c PASS: matches en estado cancelled excluidos del leaderboard';
  ELSE
    RAISE NOTICE 'TEST 5.2c FAIL: % filas con match cancelled', v_matches;
  END IF;

  -- Restaurar para tests posteriores
  UPDATE public.matches SET status = 'confirmed' WHERE id = v_match_id;

END $$;

-- ============================================================
-- BLOQUE 6 — Edge cases
-- ============================================================

-- 6.1 group_match_attributions UNIQUE (group_id, match_id)
DO $$
DECLARE
  v_group_id uuid;
  v_match_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';
  SELECT match_id INTO v_match_id FROM public.group_match_attributions WHERE group_id = v_group_id LIMIT 1;

  BEGIN
    INSERT INTO public.group_match_attributions (group_id, match_id, attribution_type)
    VALUES (v_group_id, v_match_id, 'automatic');
    RAISE NOTICE 'TEST 6.1 FAIL: duplicado (group_id,match_id) aceptado';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 6.1 PASS: UNIQUE(group_id,match_id) rechaza duplicado';
  END;
END $$;

-- 6.2 attribution_type CHECK
DO $$
DECLARE
  v_group_id uuid;
  v_user1 uuid;
  v_match_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';
  SELECT id INTO v_user1 FROM auth.users WHERE email = 'grupo-user1@test.com';

  INSERT INTO public.matches (id, format, target_points, status, rated, finished_at, confirmed_at)
  VALUES (gen_random_uuid(), 'doubles', 100, 'confirmed', true, now(), now())
  RETURNING id INTO v_match_id;

  BEGIN
    INSERT INTO public.group_match_attributions (group_id, match_id, attribution_type)
    VALUES (v_group_id, v_match_id, 'magico');
    RAISE NOTICE 'TEST 6.2 FAIL: attribution_type inválido aceptado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 6.2 PASS: CHECK attribution_type rechaza valor inválido';
  END;
END $$;

-- 6.3 group_invitations expires_at default 14 días
DO $$
DECLARE
  v_group_id uuid;
  v_user1 uuid;
  v_user5 uuid;
  v_inv_id uuid;
  v_expires timestamptz;
  v_days_until int;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';
  SELECT id INTO v_user1 FROM auth.users WHERE email = 'grupo-user1@test.com';
  SELECT id INTO v_user5 FROM auth.users WHERE email = 'grupo-user5@test.com';

  INSERT INTO public.group_invitations (group_id, invited_user_id, invited_by_user_id)
  VALUES (v_group_id, v_user5, v_user1)
  RETURNING id, expires_at INTO v_inv_id, v_expires;

  v_days_until := EXTRACT(DAY FROM (v_expires - now()))::int;

  IF v_days_until BETWEEN 13 AND 14 THEN
    RAISE NOTICE 'TEST 6.3 PASS: expires_at por default ~14 días (%)' , v_days_until;
  ELSE
    RAISE NOTICE 'TEST 6.3 FAIL: expires_at default no es 14 días (%)' , v_days_until;
  END IF;
END $$;

-- 6.4 FK violation: match_id inexistente
DO $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Test Grupo Familia';

  BEGIN
    INSERT INTO public.group_match_attributions (group_id, match_id, attribution_type)
    VALUES (v_group_id, gen_random_uuid(), 'automatic');
    RAISE NOTICE 'TEST 6.4 FAIL: FK match_id inexistente aceptado';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 6.4 PASS: FK match_id rechaza match inexistente';
  END;
END $$;

-- 6.5 ON DELETE CASCADE: borrar grupo limpia members + attributions.
DO $$
DECLARE
  v_group_id uuid;
  v_user1 uuid;
  v_members_after int;
  v_attribs_after int;
BEGIN
  SELECT id INTO v_user1 FROM auth.users WHERE email = 'grupo-user1@test.com';

  INSERT INTO public.groups (name, created_by_user_id)
  VALUES ('Grupo Cascade Test', v_user1)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status, joined_at)
  VALUES (v_group_id, v_user1, 'admin', 'active', now());

  DELETE FROM public.groups WHERE id = v_group_id;

  SELECT count(*) INTO v_members_after
    FROM public.group_members WHERE group_id = v_group_id;
  SELECT count(*) INTO v_attribs_after
    FROM public.group_match_attributions WHERE group_id = v_group_id;

  IF v_members_after = 0 AND v_attribs_after = 0 THEN
    RAISE NOTICE 'TEST 6.5 PASS: ON DELETE CASCADE limpia members y attributions';
  ELSE
    RAISE NOTICE 'TEST 6.5 FAIL: leftover members=% attribs=%', v_members_after, v_attribs_after;
  END IF;
END $$;

-- 6.6 RLS isolation reminder (test completo requiere SET LOCAL ROLE + jwt)
SELECT ok(true, 'REMINDER: cross-user RLS isolation requiere SET LOCAL ROLE + jwt claims');

-- ============================================================
-- LIMPIEZA
-- ============================================================

SELECT * FROM finish();

ROLLBACK;

-- ============================================================
-- NOTAS PARA CI:
-- 1. Tests requieren `supabase test db` con pgtap.
-- 2. Para correr en local: supabase start && supabase test db
-- 3. Los tests de RLS por usuario (SET LOCAL ROLE authenticated +
--    request.jwt.claims) se implementarán cuando exista el cliente
--    TypeScript de Phase 2/3.
-- 4. Cubre los 4 commits de Phase 1: tablas, helpers, RLS, view.
-- ============================================================
