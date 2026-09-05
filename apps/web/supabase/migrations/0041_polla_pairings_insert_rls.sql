-- ============================================================
-- 0041 — Permitir INSERT en tournament_pairings por participantes
-- de una polla (no solo por el creator)
-- ============================================================
-- Bug descubierto en sub-story 4: la policy `tp_write_creator`
-- (definida en 0008_tournament_formats.sql) solo permite que el creator
-- del torneo haga writes en tournament_pairings. Pero la decisión de
-- producto #2 del polla dice "cualquier participante puede crear
-- partidas en la polla".
--
-- Cuando un non-creator participante creaba una partida vía
-- createNewMatchInPolla, el `match` se insertaba correctamente
-- (matches no tiene RLS restrictiva en INSERT) pero el `pairing`
-- fallaba silenciosamente con RLS denial. Resultado: la partida
-- existía pero no aparecía en el leaderboard porque
-- polla_standings filtra por tournament_pairings via la view
-- polla_current_season_pairings.
--
-- Fix: agregar una policy adicional `polla_pairings_insert_participant`
-- que permite INSERT cuando el caller es participante de un torneo
-- con format='polla'. La policy existente tp_write_creator queda
-- intacta para otros formatos y para UPDATE/DELETE en cualquier formato.
--
-- Defense in depth: la validación de roster también ocurre en el
-- server action TS (createNewMatchInPolla). Esto es solo la red de
-- seguridad a nivel DB.
-- ============================================================

drop policy if exists polla_pairings_insert_participant on public.tournament_pairings;

create policy polla_pairings_insert_participant
  on public.tournament_pairings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tournaments t
      join public.tournament_players tp on tp.tournament_id = t.id
      where t.id = tournament_pairings.tournament_id
        and t.format = 'polla'
        and tp.user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
--          pg_get_expr(polwithcheck, polrelid) as check_expr
--     from pg_policy
--    where polrelid = 'public.tournament_pairings'::regclass
--    order by polname;
--
-- Test manual:
--   1. Creator A crea polla con participantes [A, B, C, D].
--   2. Participante B intenta crear partida via UI.
--   3. Verificar que el INSERT en tournament_pairings tiene éxito
--      y la partida aparece en el leaderboard.
-- ============================================================
