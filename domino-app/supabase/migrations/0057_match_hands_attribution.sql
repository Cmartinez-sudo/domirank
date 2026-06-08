-- ============================================================
-- 0057 — Hand attribution + score-keeper audit log
-- ============================================================
-- Sprint Active Match Awareness — C1 del CLAUDE_CODE_ACTIVE_MATCH_FEATURES.md
--
-- DECISIÓN DE ARQUITECTURA (anotada en PR description):
--   El spec asume crear tabla `match_hands` fresh. Pero `match_rounds`
--   ya existe (mig 0005), está en uso productivo por match-rating-compute,
--   match_live_state view, RLS, e índices. Crear `match_hands` requeriría
--   dual-write y reescritura de la view + rating engine — riesgo alto
--   sin valor incremental.
--
--   En su lugar EXTENDEMOS match_rounds con las columnas de atribución
--   que el spec quiere en match_hands:
--     • recorded_by_user_id (NOT NULL ahora; created_by se queda
--       nullable como legacy column compat, viejas filas pueden tener
--       created_by = null).
--     • last_edited_by_user_id, last_edited_at, edit_count
--     • attestation_required, attestation_status
--
--   El concepto "hand" del spec se mapea 1:1 a "round" en DomiRank.
--   En la UI los llamamos "manos" (idioma); en DB son "rounds" por
--   consistencia con el resto del schema.
--
-- match_score_keepers nuevo (tabla):
--   Audit log de transferencias. matches.scorekeeper_id (ya existe
--   desde mig 0016) sigue siendo la single-source-of-truth de "quién
--   es el score-keeper actual". match_score_keepers solo registra
--   transferencias para auditabilidad.
--
-- Dependencias: 0005 (match_rounds), 0016 (matches.scorekeeper_id).
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- 1. Extender match_rounds con columnas de atribución.

alter table public.match_rounds
  add column if not exists recorded_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_edited_at timestamptz,
  add column if not exists edit_count int not null default 0,
  add column if not exists attestation_required boolean not null default false,
  add column if not exists attestation_status text
    check (attestation_status is null or attestation_status in ('pending','approved','rejected'));

-- Backfill recorded_by_user_id desde created_by para filas existentes.
-- Solo donde recorded_by es NULL y created_by no (defensivo).
update public.match_rounds
   set recorded_by_user_id = created_by
 where recorded_by_user_id is null
   and created_by is not null;

comment on column public.match_rounds.recorded_by_user_id is
  'Quien metió la mano originalmente. Para edit permissions + UI attribution.';
comment on column public.match_rounds.last_edited_by_user_id is
  'NULL si nunca fue editada. Si no NULL, UI muestra icon ámbar.';
comment on column public.match_rounds.edit_count is
  'Veces editada. UI puede mostrar "editada 2 veces".';

-- Índice para queries de "manos registradas por user X" (perfil / stats).
create index if not exists idx_match_rounds_recorded_by
  on public.match_rounds (recorded_by_user_id);

-- 2. Audit log de score-keeper.
--    matches.scorekeeper_id sigue siendo SSOT. Esta tabla solo loggea
--    transferencias para que se pueda auditar "Carlos fue keeper de
--    minuto 0 a 12, después Erik tomó el control".

create table if not exists public.match_score_keepers (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by_user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  ended_at timestamptz,
  check ((active and ended_at is null) or (not active and ended_at is not null))
);

create index if not exists idx_keepers_match_active
  on public.match_score_keepers (match_id)
  where active = true;

-- Solo un score-keeper activo por match (constraint enforce a nivel DB).
create unique index if not exists one_active_keeper_per_match
  on public.match_score_keepers (match_id)
  where active = true;

comment on table public.match_score_keepers is
  'Audit log de quién ha sido score-keeper en cada match. matches.scorekeeper_id es la SSOT del actual; esta tabla preserva el histórico de transferencias.';

-- Backfill: para matches in_progress/pending/confirmed que ya existen y
-- tienen scorekeeper_id asignado pero ninguna fila en match_score_keepers,
-- crear una fila inicial. Defensivo: solo si scorekeeper_id no NULL.
insert into public.match_score_keepers (match_id, user_id, assigned_by_user_id, active, assigned_at, ended_at)
select
  m.id,
  coalesce(m.scorekeeper_id, m.created_by),
  m.created_by,
  case when m.status in ('in_progress','pending_attestation') then true else false end,
  m.created_at,
  case
    when m.status in ('in_progress','pending_attestation') then null
    else coalesce(m.confirmed_at, m.finalized_at, m.finished_at, now())
  end
from public.matches m
where m.scorekeeper_id is not null
  and not exists (
    select 1 from public.match_score_keepers k where k.match_id = m.id
  );

-- Para matches in_progress sin scorekeeper_id (creadas antes de mig 0016),
-- el creator se considera el score-keeper inicial.
insert into public.match_score_keepers (match_id, user_id, assigned_by_user_id, active, assigned_at)
select
  m.id,
  m.created_by,
  m.created_by,
  true,
  m.created_at
from public.matches m
where m.scorekeeper_id is null
  and m.status = 'in_progress'
  and not exists (
    select 1 from public.match_score_keepers k where k.match_id = m.id
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Columnas nuevas en match_rounds:
--      select column_name, data_type from information_schema.columns
--       where table_schema='public' and table_name='match_rounds'
--         and column_name in ('recorded_by_user_id','last_edited_by_user_id',
--                             'last_edited_at','edit_count',
--                             'attestation_required','attestation_status');
--    Esperado: 6 filas.
--
-- 2. Backfill correcto:
--      select count(*) filter (where recorded_by_user_id is not null) as backfilled,
--             count(*) filter (where created_by is not null and recorded_by_user_id is null) as missed
--        from public.match_rounds;
--    Esperado: missed = 0.
--
-- 3. match_score_keepers tabla + 1 fila activa por match in_progress:
--      select count(*) filter (where active) from public.match_score_keepers;
--      select count(*) from public.matches where status = 'in_progress';
--    Esperado: ambos números iguales (cada in_progress tiene 1 keeper activo).
--
-- 4. Constraint de "1 active keeper per match" funciona:
--      Intentar INSERT duplicado debe fallar con duplicate key error.
-- ============================================================
