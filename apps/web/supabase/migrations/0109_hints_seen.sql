-- ============================================================
-- DomiRank · migración 0109
-- Sprint 1c: Coach marks / first-time-use hints (Regla 14).
--
-- profiles.hints_seen jsonb — array de hint_ids que el user ya cerró.
-- El componente <Hint id="..."> se auto-oculta si el id está en el array.
-- Sin librería externa; el hook useHint decide client-side.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hints_seen jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Helper RPC para marcar hint como visto (append idempotente).
CREATE OR REPLACE FUNCTION public.mark_hint_seen(p_hint_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT hints_seen INTO v_current FROM public.profiles WHERE id = v_uid;
  IF v_current IS NULL THEN v_current := '[]'::jsonb; END IF;

  IF v_current @> to_jsonb(ARRAY[p_hint_id]) THEN
    RETURN v_current;
  END IF;

  UPDATE public.profiles
     SET hints_seen = v_current || to_jsonb(ARRAY[p_hint_id])
   WHERE id = v_uid
  RETURNING hints_seen INTO v_current;

  RETURN v_current;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_hint_seen(text) TO authenticated;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Columna existe:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'profiles' AND column_name = 'hints_seen';
--
-- 2. RPC funciona:
--      SELECT public.mark_hint_seen('first_match_button');
--      -- devuelve jsonb con el id agregado. Segunda llamada = idempotente.
-- ============================================================
