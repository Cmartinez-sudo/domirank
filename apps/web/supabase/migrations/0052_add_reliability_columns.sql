-- ============================================================
-- 0052 — Reliability Score columns + is_rated GENERATED
-- ============================================================
-- Sprint Reliability NR — F1.1 del RELIABILITY_NR_HOW_IT_WORKS.md.
--
-- Agrega 7 columnas a public.profiles:
--   • reliability_score smallint 0..100 — score compuesto
--   • reliability_volume real 0..1     — factor de volumen (35% weight)
--   • reliability_recency real 0..1    — factor de recencia (25%)
--   • reliability_attestation real 0..1 — % matches con consenso (25%)
--   • reliability_diversity real 0..1   — distinct opponents (15%)
--   • reliability_updated_at timestamptz — última recomputación
--   • is_rated boolean GENERATED      — true si (singles_games+doubles_games) >= 5
--
-- Decisiones de mapeo vs spec:
--   • Spec usa tabla "players" → DomiRank usa "profiles".
--   • Spec usa column "matches_attested_count" → en DomiRank
--     singles_games+doubles_games YA es el count de matches confirmed
--     (verificado en applyMatchRating server action).
--   • is_rated es GENERATED STORED — no requiere trigger, indexable.
--   • NR_THRESHOLD = 5 hardcoded (no tabla feature_flags por ahora).
--
-- Dependencias: 0001 (profiles existe con singles_games, doubles_games).
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- 1. Columnas de breakdown (real entre 0 y 1) y score agregado.
alter table public.profiles
  add column if not exists reliability_score smallint not null default 0
    check (reliability_score between 0 and 100),
  add column if not exists reliability_volume real not null default 0
    check (reliability_volume between 0 and 1),
  add column if not exists reliability_recency real not null default 0
    check (reliability_recency between 0 and 1),
  add column if not exists reliability_attestation real not null default 0
    check (reliability_attestation between 0 and 1),
  add column if not exists reliability_diversity real not null default 0
    check (reliability_diversity between 0 and 1),
  add column if not exists reliability_updated_at timestamptz;

-- 2. is_rated — GENERATED STORED para que Postgres lo mantenga atómicamente
--    en cada UPDATE de singles_games/doubles_games (que sucede en
--    applyMatchRating server action cuando match → confirmed).
--
--    NR_THRESHOLD = 5 hardcoded acá. Si después se hace configurable,
--    bajar el threshold solo "promueve" jugadores existentes a is_rated;
--    subirlo "demote" — ambos cases seguros desde DB.

-- Defensivo por si la columna existe parcialmente (e.g., migración rota).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'is_rated'
  ) then
    alter table public.profiles
      add column is_rated boolean generated always as
        ((singles_games + doubles_games) >= 5) stored;
  end if;
end$$;

-- 3. Índices para queries comunes.
create index if not exists idx_profiles_reliability
  on public.profiles (reliability_score desc);

-- Índice parcial — leaderboard global filtra is_rated = true.
create index if not exists idx_profiles_is_rated
  on public.profiles (is_rated) where is_rated = true;

-- 4. Comments documentación.
comment on column public.profiles.reliability_score is
  '0-100 score: confidence in player rating. Composite of volume + recency + attestation + diversity. See RELIABILITY_NR_HOW_IT_WORKS.md';

comment on column public.profiles.reliability_volume is
  '0-1: min(1, matches_attested / 30). 35% weight in reliability_score.';

comment on column public.profiles.reliability_recency is
  '0-1: min(1, matches_last_60d / 10). 25% weight.';

comment on column public.profiles.reliability_attestation is
  '0-1: attested / total. Penalizes self-reported. 25% weight.';

comment on column public.profiles.reliability_diversity is
  '0-1: min(1, distinct_opponents / 15). 15% weight.';

comment on column public.profiles.is_rated is
  'NR state: true once total confirmed matches >= 5 (NR_THRESHOLD). GENERATED.';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Columnas existen + check constraints:
--      select column_name, data_type, is_nullable, column_default,
--             is_generated, generation_expression
--        from information_schema.columns
--       where table_schema='public' and table_name='profiles'
--         and column_name like 'reliability_%' or column_name='is_rated'
--       order by column_name;
--    Esperado: 6 columnas reliability_* + is_rated GENERATED ALWAYS.
--
-- 2. is_rated calculado correctamente para perfiles existentes:
--      select count(*) as total,
--             count(*) filter (where is_rated = true) as rated,
--             count(*) filter (where (singles_games + doubles_games) >= 5) as expected_rated
--        from public.profiles;
--    Esperado: rated = expected_rated.
--
-- 3. Defaults aplicados (todas las filas existentes: reliability_score=0):
--      select count(*) from public.profiles where reliability_score = 0;
--    Esperado: count(*) from profiles. El backfill (mig 0055) recomputará.
--
-- 4. Índices existen:
--      select indexname from pg_indexes
--       where schemaname='public' and tablename='profiles'
--         and indexname like 'idx_profiles_%';
--    Esperado: idx_profiles_reliability + idx_profiles_is_rated.
-- ============================================================
