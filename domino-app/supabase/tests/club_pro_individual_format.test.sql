-- ============================================================
-- Club Pro: Individual Format (Migration 0097) — Tests (pgTAP)
-- ============================================================
-- Cubre los cambios introducidos en 0097_org_tournaments_individual_format.sql:
--   • Nullabilidad de player_b_name/email en org_tournament_pairs.
--   • CHECK pair_consistency (ambos NULL o ambos NOT NULL).
--   • CHECK format_check actualizado (swiss_pairs | swiss_individual).
--   • Trigger trg_enforce_pair_format_consistency.
--   • Trigger trg_enforce_tournament_format_immutable.
--   • View tournament_public_display expone column format.
--
-- Cómo correr:
--   supabase test db
--
-- Aislado del test base de Phase 1: usa org/torneos con slugs propios.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(19);

-- ============================================================
-- BLOQUE 1 — Schema
-- ============================================================

-- 1.1 Nullabilidad
SELECT col_is_null(
  'public', 'org_tournament_pairs', 'player_b_name',
  'player_b_name es NULLABLE (post 0097)'
);
SELECT col_is_null(
  'public', 'org_tournament_pairs', 'player_b_email',
  'player_b_email es NULLABLE (post 0097)'
);

-- 1.2 CHECK constraint pair_consistency existe
SELECT col_has_check(
  'public', 'org_tournament_pairs', 'player_b_name',
  'CHECK constraint pair_consistency referencia player_b_name'
);

-- 1.3 View tournament_public_display tiene columna format + las preexistentes
-- (regression guard: CREATE OR REPLACE VIEW en 0097 NO debe dropear columnas
--  de migrations anteriores como sponsors o target_points).
SELECT has_column(
  'public', 'tournament_public_display', 'format',
  'tournament_public_display expone format'
);
SELECT has_column(
  'public', 'tournament_public_display', 'target_points',
  'tournament_public_display preserva target_points (post-0081)'
);
SELECT has_column(
  'public', 'tournament_public_display', 'tournament_logo_url',
  'tournament_public_display preserva tournament_logo_url (post-0084)'
);
SELECT has_column(
  'public', 'tournament_public_display', 'sponsor_1_logo_url',
  'tournament_public_display preserva sponsor_1_logo_url (post-0084)'
);
SELECT has_column(
  'public', 'tournament_public_display', 'sponsor_2_logo_url',
  'tournament_public_display preserva sponsor_2_logo_url (post-0084)'
);

-- 1.4 Triggers existen
SELECT has_trigger(
  'public', 'org_tournament_pairs', 'trg_enforce_pair_format_consistency',
  'Trigger trg_enforce_pair_format_consistency en org_tournament_pairs'
);
SELECT has_trigger(
  'public', 'org_tournaments', 'trg_enforce_tournament_format_immutable',
  'Trigger trg_enforce_tournament_format_immutable en org_tournaments'
);

-- ============================================================
-- BLOQUE 2 — Setup: org + torneos
-- ============================================================

DO $$
DECLARE
  v_user_id   uuid := gen_random_uuid();
  v_org_id    uuid;
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, email_confirmed_at, aud, role)
  VALUES (v_user_id, 'individual-fmt@test.com', now(), now(), '{}', '{}', false, '', now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, slug, contact_email, created_by_user_id)
  VALUES ('Individual Fmt Test', 'individual-fmt-test', 'isabel@test.com', v_user_id)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_org_id;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'individual-fmt-test';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Torneo PAIRS
  INSERT INTO public.org_tournaments (
    organization_id, name, format, rounds_count,
    round_duration_minutes, display_slug, status
  )
  VALUES (v_org_id, 'T Pairs', 'swiss_pairs', 4, 30, 'indfmt-pairs', 'draft')
  ON CONFLICT (display_slug) DO NOTHING;

  -- Torneo INDIVIDUAL
  INSERT INTO public.org_tournaments (
    organization_id, name, format, rounds_count,
    round_duration_minutes, display_slug, status
  )
  VALUES (v_org_id, 'T Ind', 'swiss_individual', 4, 30, 'indfmt-individual', 'draft')
  ON CONFLICT (display_slug) DO NOTHING;
END $$;

-- 2.1 Torneo individual existe
SELECT is(
  (SELECT format FROM public.org_tournaments WHERE display_slug = 'indfmt-individual'),
  'swiss_individual',
  'Torneo con format=swiss_individual creado OK'
);

-- ============================================================
-- BLOQUE 3 — Trigger: pair ↔ format consistency
-- ============================================================

-- 3.1 PAIRS torneo + pair con player_b NULL → FALLA
SELECT throws_ok(
  $sql$
    INSERT INTO public.org_tournament_pairs (
      tournament_id, player_a_name, player_a_email
    )
    SELECT id, 'Pedro', 'pedro-bad-pairs@test.com'
    FROM public.org_tournaments WHERE display_slug = 'indfmt-pairs'
  $sql$,
  'P0001',
  'Tournament is pairs — player_b_name is required',
  'Pair sin player_b en torneo PAIRS es rechazado'
);

-- 3.2 INDIVIDUAL torneo + pair con player_b NOT NULL → FALLA
SELECT throws_ok(
  $sql$
    INSERT INTO public.org_tournament_pairs (
      tournament_id, player_a_name, player_a_email,
      player_b_name, player_b_email
    )
    SELECT id, 'Pedro', 'pedro-bad-ind@test.com', 'Maria', 'maria-bad-ind@test.com'
    FROM public.org_tournaments WHERE display_slug = 'indfmt-individual'
  $sql$,
  'P0001',
  'Tournament is individual — player_b_name must be NULL',
  'Pair con player_b en torneo INDIVIDUAL es rechazado'
);

-- 3.3 PAIRS torneo + pair completa → OK
SELECT lives_ok(
  $sql$
    INSERT INTO public.org_tournament_pairs (
      tournament_id, player_a_name, player_a_email,
      player_b_name, player_b_email
    )
    SELECT id, 'Pedro', 'pedro-ok-pairs@test.com', 'Maria', 'maria-ok-pairs@test.com'
    FROM public.org_tournaments WHERE display_slug = 'indfmt-pairs'
  $sql$,
  'Pair completa en torneo PAIRS se inserta OK'
);

-- 3.4 INDIVIDUAL torneo + pair sin player_b → OK
SELECT lives_ok(
  $sql$
    INSERT INTO public.org_tournament_pairs (
      tournament_id, player_a_name, player_a_email
    )
    SELECT id, 'Pedro Ind', 'pedro-ok-ind@test.com'
    FROM public.org_tournaments WHERE display_slug = 'indfmt-individual'
  $sql$,
  'Pair sin player_b en torneo INDIVIDUAL se inserta OK'
);

-- ============================================================
-- BLOQUE 4 — Trigger: format immutable
-- ============================================================

-- 4.1 UPDATE format → FALLA
SELECT throws_ok(
  $sql$
    UPDATE public.org_tournaments
    SET format = 'swiss_pairs'
    WHERE display_slug = 'indfmt-individual'
  $sql$,
  'P0001',
  NULL,
  'UPDATE de format es rechazado por trigger immutability'
);

-- 4.2 UPDATE de otro campo (name) → OK (no debe disparar el trigger)
SELECT lives_ok(
  $sql$
    UPDATE public.org_tournaments
    SET name = 'T Ind Renombrado'
    WHERE display_slug = 'indfmt-individual'
  $sql$,
  'UPDATE de otro campo no dispara format immutability'
);

-- ============================================================
-- BLOQUE 5 — CHECK constraint pair_consistency (a nivel row)
-- ============================================================

-- 5.1 Mix (name NOT NULL, email NULL) → FALLA por CHECK
--     (no llega al trigger porque el CHECK se evalúa antes en el INSERT).
SELECT throws_ok(
  $sql$
    INSERT INTO public.org_tournament_pairs (
      tournament_id, player_a_name, player_a_email,
      player_b_name, player_b_email
    )
    SELECT id, 'Pedro', 'pedro-mix@test.com', 'Maria', NULL
    FROM public.org_tournaments WHERE display_slug = 'indfmt-pairs'
  $sql$,
  '23514',  -- check_violation
  NULL,
  'Mix de player_b (name NOT NULL, email NULL) rechazado por CHECK'
);

SELECT * FROM finish();

ROLLBACK;
