-- ============================================================
-- DomiRank · migración 0110
-- Hotfix post-1b: backfillear first_valuable_action_at para usuarios
-- que ya jugaron partidas ANTES de que existiera la columna.
--
-- Sin este backfill, todos los legacy con partidas jugadas veían el P1
-- "trae a tu mesa" bloqueando el dashboard después del deploy de 1b —
-- porque first_valuable_action_at IS NULL Y p1_dismissed_count=0.
--
-- Regla: si el user tiene ≥1 registro en match_players con match confirmed,
-- consideramos que ya cumplió la primera acción con valor
-- (vía "match_created_with_cojugador" — asumido, la vía real la perdimos).
-- ============================================================

UPDATE public.profiles p
   SET first_valuable_action_at = sub.first_confirmed_at,
       first_valuable_action_via = 'match_created_with_cojugador'
  FROM (
    SELECT mp.user_id, MIN(m.created_at) AS first_confirmed_at
      FROM public.match_players mp
      JOIN public.matches m ON m.id = mp.match_id
     WHERE m.status = 'confirmed'
     GROUP BY mp.user_id
  ) sub
 WHERE p.id = sub.user_id
   AND p.first_valuable_action_at IS NULL;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. ¿Cuántos usuarios se backfilearon?
--      SELECT count(*) FROM profiles WHERE first_valuable_action_at IS NOT NULL;
--
-- 2. Nadie con partidas confirmadas debería quedar sin FVA:
--      SELECT count(*) FROM profiles p
--       WHERE p.first_valuable_action_at IS NULL
--         AND EXISTS (
--           SELECT 1 FROM match_players mp
--            JOIN matches m ON m.id = mp.match_id
--           WHERE mp.user_id = p.id AND m.status = 'confirmed'
--         );
--    Esperado: 0.
-- ============================================================
