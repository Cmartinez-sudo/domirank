-- ============================================================
-- 0066 — Match cancellation schema (soft delete + audit + undo)
-- ============================================================
-- Sprint Match Cancellation — F1.
--
-- NOTA DE NUMBERING: 0057-0065 ya están aplicadas en remoto (vienen de
-- la branch feature/active-match-awareness, PR #15 abierto). Esta branch
-- arranca desde main pero usa números 0066+ para evitar colisión con
-- las migrations ya registradas en `supabase_migrations.schema_migrations`.
--
-- Aporta:
--   1. matches.updated_at + trigger BEFORE UPDATE (auto-bumps on any update)
--   2. matches.cancelled_at, cancelled_by_user_id, cancellation_reason,
--      cancellation_undo_until — soft delete metadata
--   3. matches.inactivity_warning_sent_at — para no duplicar warnings
--   4. match_cancellation_events — audit log de cancel/undo/finalize
--
-- Spec mapping:
--   • match_hands del spec → match_rounds (real)
--   • match_participants → match_players (real)
--   • 'attested' status → 'confirmed' (real)
--   • 'scheduled' status no existe en DomiRank — matches arrancan in_progress
--   • 'cancelled' YA está en el enum → no requiere ALTER del check
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- 1. updated_at column + trigger.
--    matches no tenía updated_at → cron de auto-cleanup necesita timestamp
--    de "última actividad" para detectar zombies.

alter table public.matches
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.tg_touch_updated_at() is
  'Reusable BEFORE UPDATE trigger fn que setea updated_at = now().';

drop trigger if exists trg_matches_touch_updated_at on public.matches;

create trigger trg_matches_touch_updated_at
  before update on public.matches
  for each row
  execute function public.tg_touch_updated_at();

-- 2. Cancel metadata columns.

alter table public.matches
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text check (
    cancellation_reason is null or cancellation_reason in (
      'user_cancelled',       -- usuario tocó "Cancelar"
      'inactivity_auto',      -- cron por > 2h sin updates
      'migration_cleanup',    -- one-shot al deploy para zombies legacy
      'replaced_by_new_match',-- startLiveMatch auto-cancela la previa
      'host_no_show'          -- futuro
    )
  ),
  add column if not exists cancellation_undo_until timestamptz,
  add column if not exists inactivity_warning_sent_at timestamptz;

comment on column public.matches.cancellation_undo_until is
  '5-min window after cancel during which any participant can call undo_cancellation. NULL = no undo possible (either expired, finalized via cron, or never cancelled).';

comment on column public.matches.inactivity_warning_sent_at is
  'Set by the auto-cancel cron when the 1h warning notification fires. Prevents duplicate warnings.';

create index if not exists idx_matches_cancelled
  on public.matches (cancelled_at)
  where cancelled_at is not null;

create index if not exists idx_matches_active_updated_at
  on public.matches (updated_at)
  where status in ('in_progress', 'pending_attestation');

-- 3. Audit log table.

create table if not exists public.match_cancellation_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  action text not null check (action in ('cancelled', 'undone', 'finalized', 'warning_sent')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cancel_events_match
  on public.match_cancellation_events (match_id);

create index if not exists idx_cancel_events_created
  on public.match_cancellation_events (created_at desc);

alter table public.match_cancellation_events enable row level security;

-- SELECT: participantes del match pueden leer su audit.
create policy cancel_events_select_participants
  on public.match_cancellation_events for select
  using (
    exists (
      select 1 from public.match_players mp
       where mp.match_id = match_cancellation_events.match_id
         and mp.user_id = auth.uid()
    )
  );

-- INSERT: solo via RPC (security definer). Sin policy → bloqueado a clients.

comment on table public.match_cancellation_events is
  'Audit log de cancel/undo/finalize/warning_sent. Permite reconstruir "Carlos canceló 14:32, María undid 14:34, Pedro canceló 14:40".';

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. updated_at exists + trigger:
--      select column_name from information_schema.columns
--       where table_name='matches' and column_name='updated_at';
--      select tgname from pg_trigger where tgname='trg_matches_touch_updated_at';
--    Esperado: 1 fila cada uno.
--
-- 2. Cancel columns:
--      select column_name from information_schema.columns
--       where table_name='matches'
--         and column_name in ('cancelled_at','cancelled_by_user_id',
--                             'cancellation_reason','cancellation_undo_until',
--                             'inactivity_warning_sent_at');
--    Esperado: 5 filas.
--
-- 3. Audit table + RLS:
--      select * from pg_policy where polrelid='public.match_cancellation_events'::regclass;
--    Esperado: 1 policy (cancel_events_select_participants).
-- ============================================================
