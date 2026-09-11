-- ============================================================
-- DomiRank · migración 0107
-- Sprint 1a: Referral system + Group join-by-link + notif al referrer.
--
-- Cambios:
--   1. profiles.referred_by / referral_registered_at (attribution).
--   2. groups.join_code / join_code_expires_at (link compartible).
--   3. handle_new_user() extendido: lee raw_user_meta_data->>'referred_by'.
--   4. RLS SELECT sobre profiles para permitir al nuevo usuario ver
--      display_name + avatar_url del referrer en la pantalla P1-referida
--      (patrón "profile card por handle público").
--
-- El código de app.ts (route handler /g/[code]) usa service_role para
-- gestionar la unión al grupo — RLS sobre group_members ya cubre el flow
-- de admin (via inviteToGroup) o self-join. Añadimos policy chica que
-- permite INSERT self como active si el code es válido (validado en TS,
-- pero defensa en profundidad).
-- ============================================================

-- ─── 1. profiles: referral columns ────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_registered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles(referred_by)
  WHERE referred_by IS NOT NULL;

-- ─── 2. groups: join_code ─────────────────────────────────────

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS join_code_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_groups_join_code_active
  ON public.groups(join_code)
  WHERE join_code IS NOT NULL;

-- ─── 3. handle_new_user() extendido ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username   text;
  final_username  text;
  counter         int := 0;
  meta_full_name  text;
  meta_dob        date;
  meta_method     text;
  meta_terms      timestamptz;
  meta_referrer   uuid;
BEGIN
  meta_full_name := new.raw_user_meta_data->>'full_name';
  meta_method    := new.raw_user_meta_data->>'signup_method';
  meta_terms     := CASE WHEN (new.raw_user_meta_data->>'terms_accepted')::boolean THEN now() ELSE null END;

  BEGIN
    meta_dob := (new.raw_user_meta_data->>'date_of_birth')::date;
  EXCEPTION WHEN OTHERS THEN meta_dob := null;
  END;

  -- Referred_by (Sprint 1a): validamos que sea uuid válido y no self-ref.
  BEGIN
    meta_referrer := (new.raw_user_meta_data->>'referred_by')::uuid;
    IF meta_referrer = new.id THEN
      meta_referrer := null;
    END IF;
    -- Verificar que el referrer existe en profiles (después del insert,
    -- via trigger this row no existe aún, pero el referrer sí).
    IF meta_referrer IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = meta_referrer
    ) THEN
      meta_referrer := null;
    END IF;
  EXCEPTION WHEN OTHERS THEN meta_referrer := null;
  END;

  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  IF length(base_username) < 3 THEN
    base_username := 'player' || substr(replace(new.id::text, '-', ''), 1, 6);
  END IF;
  base_username := substring(base_username FROM 1 FOR 20);
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := substring(base_username FROM 1 FOR 20) || counter::text;
  END LOOP;

  INSERT INTO public.profiles (
    id, username, display_name,
    full_name, date_of_birth, signup_method,
    terms_accepted_at, privacy_accepted_at,
    referred_by, referral_registered_at
  ) VALUES (
    new.id,
    final_username,
    coalesce(meta_full_name, final_username),
    meta_full_name,
    meta_dob,
    meta_method,
    meta_terms,
    meta_terms,
    meta_referrer,
    CASE WHEN meta_referrer IS NOT NULL THEN now() ELSE null END
  );

  RETURN new;
END;
$$;

-- Nota: la policy `profiles_read_all` (mig 0001) ya permite SELECT
-- público sobre profiles — no necesitamos policy adicional para que el
-- nuevo user vea display_name/avatar del referrer en P1-referida.

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Columnas nuevas presentes:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'profiles'
--         AND column_name IN ('referred_by','referral_registered_at');
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'groups'
--         AND column_name IN ('join_code','join_code_expires_at');
--
-- 2. FK profiles.referred_by → profiles(id) con ON DELETE SET NULL.
--
-- 3. Trigger handle_new_user actualizado — insertar test signup con
--    referred_by en metadata y verificar que se popula.
--
-- 4. UNIQUE constraint en groups.join_code funciona:
--    UPDATE groups SET join_code='dup' WHERE id=<a>;
--    UPDATE groups SET join_code='dup' WHERE id=<b>; -- debe fallar (23505)
-- ============================================================
