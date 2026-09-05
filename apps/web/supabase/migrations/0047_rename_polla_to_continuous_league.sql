-- ============================================================
-- 0047 — Rename 'polla' -> 'continuous_league' (enum value)
-- ============================================================
-- F1.1 del refactor TOURNAMENT_WIZARD_REFACTOR.md.
--
-- Esta migración renombra el valor 'polla' a 'continuous_league'
-- en los dos check constraints del enum-like de tournaments
-- (format e inscription_mode), hace backfill de las filas existentes,
-- y actualiza los demás artefactos del schema que referencian
-- el literal 'polla' (cross-field constraint + RLS policy).
--
-- IMPORTANTE: NO renombra las funciones RPC (polla_standings,
-- polla_best_partner, polla_worst_rival, polla_user_streak) ni la
-- view polla_current_season_pairings — eso es parte de F1.2 (rename
-- de código). Esta migración solo toca los valores del enum y el
-- backfill de datos.
--
-- ORDEN CRÍTICO (idéntico al patrón de la mig 0042):
--   Para cada constraint:
--     1. DROP el constraint viejo (con 'polla')
--     2. UPDATE backfill (ahora permitido — sin constraint)
--     3. ADD el constraint nuevo (con 'continuous_league' en vez de 'polla')
--
--   Si invertís el orden (UPDATE primero), Postgres chequea el constraint
--   viejo contra el valor nuevo y rechaza con
--   "violates check constraint tournaments_format_check".
--   Si agregás el constraint nuevo antes del UPDATE, falla porque las
--   filas existentes tienen 'polla' que no pasa el nuevo check.
--
-- ARTEFACTOS DEPENDIENTES (también actualizados acá):
--   - tournaments_format_inscription_check (cross-field, mig 0042)
--   - polla_pairings_insert_participant RLS policy (mig 0041)
--
-- Migración idempotente: usa `drop ... if exists` en todos lados.
-- Las funciones polla_* siguen funcionando porque solo dependen de
-- joins por id, no del literal 'polla'.
-- ============================================================

-- ============================================================
-- 1. DROP de los 3 constraints AFECTADOS antes de cualquier UPDATE.
-- ============================================================
-- El cross-field constraint `tournaments_format_inscription_check` (de
-- mig 0042) exige que format e inscription_mode sean AMBOS 'polla' o
-- AMBOS no-polla. Si solo se hace UPDATE de format primero (sin tocar
-- inscription_mode), las filas con AMBOS = 'polla' quedan transient
-- state inválido (format='continuous_league' AND inscription_mode='polla')
-- y la check constraint los rechaza inmediatamente.
--
-- Solución: dropear los TRES constraints primero, hacer ambos UPDATEs
-- en cualquier orden, y recrear los TRES al final con los literales
-- nuevos.

alter table public.tournaments
  drop constraint if exists tournaments_format_check;

alter table public.tournaments
  drop constraint if exists tournaments_inscription_mode_check;

alter table public.tournaments
  drop constraint if exists tournaments_format_inscription_check;

-- ============================================================
-- 2. Backfill: ahora que no hay constraints, los UPDATEs son safe.
-- ============================================================
-- IMPORTANTE: hacemos los dos UPDATEs en orden, pero el cross-field
-- constraint todavía no existe, así que no rechaza estados transient.

update public.tournaments
   set format = 'continuous_league'
 where format = 'polla';

update public.tournaments
   set inscription_mode = 'continuous_league'
 where inscription_mode = 'polla';

-- ============================================================
-- 3. ADD los constraints nuevos con 'continuous_league'.
-- ============================================================

-- 3a. format check
alter table public.tournaments
  add constraint tournaments_format_check
  check (format in (
    'single_elim', 'round_robin', 'swiss', 'continuous_league',
    'rotation', 'double_elim', 'points_league'
  ));

-- 3b. inscription_mode check
-- Spec del wizard refactor agrega 'mexicano' al enum (preparación
-- para F2). La lista nueva es:
--   'pre_formed', 'individual_manual', 'mexicano', 'continuous_league'
alter table public.tournaments
  add constraint tournaments_inscription_mode_check
  check (inscription_mode in (
    'pre_formed', 'individual_manual', 'mexicano', 'continuous_league'
  ));

-- 3c. cross-field constraint
-- Reemplaza el de mig 0042 con literales 'continuous_league' en
-- ambos lados. El invariante es: format e inscription_mode están
-- "linked" — si uno es continuous_league, el otro también; si uno
-- es otra cosa, el otro también es otra cosa.
alter table public.tournaments
  add constraint tournaments_format_inscription_check
  check (
    (format = 'continuous_league' and inscription_mode = 'continuous_league')
    or (format <> 'continuous_league' and inscription_mode <> 'continuous_league')
  );

-- ============================================================
-- 4. RLS policy polla_pairings_insert_participant: literal 'polla' -> 'continuous_league'
-- ============================================================
-- La policy de 0041 permite INSERT en tournament_pairings cuando el
-- caller es participante de un torneo con format='polla'. Después del
-- rename, sin este UPDATE los participantes de continuous_leagues nuevos
-- (y los preexistentes ya backfilled) no podrían insertar pairings — bug
-- funcional silencioso (la partida se crea pero el pairing falla y no
-- aparece en standings).
--
-- NOTA: el nombre de la policy se mantiene como `polla_pairings_insert_participant`
-- por ahora — el rename del nombre de la policy va en F1.2 junto con
-- el rename de las RPCs y la view. Acá solo cambiamos el predicado.

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
        and t.format = 'continuous_league'
        and tp.user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Confirmar que NO quedan filas con valor 'polla' en ninguna columna:
--      select count(*) as polla_format_remaining
--        from public.tournaments where format = 'polla';
--      select count(*) as polla_inscription_remaining
--        from public.tournaments where inscription_mode = 'polla';
--    Ambos deben devolver 0.
--
-- 2. Distribución de valores backfilled:
--      select format, inscription_mode, count(*)
--        from public.tournaments
--       where format = 'continuous_league' or inscription_mode = 'continuous_league'
--       group by format, inscription_mode;
--    Esperado: todas las filas tienen ambos = 'continuous_league'.
--
-- 3. Definiciones de los constraints actualizados:
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--       where conname in (
--         'tournaments_format_check',
--         'tournaments_inscription_mode_check',
--         'tournaments_format_inscription_check'
--       );
--
-- 4. Predicado de la RLS policy:
--      select polname, pg_get_expr(polwithcheck, polrelid) as check_expr
--        from pg_policy
--       where polrelid = 'public.tournament_pairings'::regclass
--         and polname = 'polla_pairings_insert_participant';
--    El check_expr debe contener `format = 'continuous_league'::text`.
-- ============================================================
