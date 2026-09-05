-- ============================================================
-- 0029 — Time-Based Matches (R6)
-- ============================================================
-- Idempotente: usa IF NOT EXISTS donde aplica.
-- Requisito previo: 0028_tournament_notifications.sql ya aplicado.
--
-- Columnas agregadas a matches:
--   time_limit_minutes  — duración en minutos (null = sin límite)
--   timer_started_at    — timestamp cuando arrancó el reloj
--
-- Decisión de diseño — NO hay columna `time_expired` stored:
--   Postgres requiere que las expresiones de columnas GENERATED ALWAYS AS
--   STORED sean IMMUTABLE, y now() es STABLE — la combinación es ilegal.
--   La fuente de verdad para "¿expiró?" es:
--     - Cliente: hook useMatchTimer (en tiempo real, compara Date.now())
--     - Server: finalizeMatch() recalcula desde timer_started_at +
--       time_limit_minutes antes de aceptar el cierre.
--   Si en el futuro se necesita una vista SQL con time_expired calculado,
--   se puede crear una VIEW (no una columna):
--     create view matches_with_expiry as
--       select *,
--              (timer_started_at is not null
--               and time_limit_minutes is not null
--               and now() > timer_started_at + (time_limit_minutes || ' minutes')::interval
--              ) as time_expired
--       from public.matches;
-- ============================================================

alter table public.matches
  add column if not exists time_limit_minutes int;

alter table public.matches
  add column if not exists timer_started_at timestamptz;

-- Índice parcial para buscar partidas con timer activo (e.g., cron de cleanup).
create index if not exists idx_matches_timer_active
  on public.matches(timer_started_at)
  where timer_started_at is not null;

-- ============================================================
-- PASOS MANUALES POST-MIGRACIÓN
-- Aplicar después de 0028_tournament_notifications.sql:
--   supabase db push
--   -- o pegando este contenido en el SQL Editor de Supabase
--
-- Verificar con:
--   select column_name, data_type
--   from information_schema.columns
--   where table_name = 'matches' and table_schema = 'public'
--     and column_name in ('time_limit_minutes', 'timer_started_at')
--   order by column_name;
-- ============================================================
