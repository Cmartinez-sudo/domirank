-- Migration: 0034_user_preferences
-- Feature: US-04 — user_preferences table + RLS + trigger
-- Idempotent: safe to re-run

create table if not exists public.user_preferences (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  default_match_modality text check (default_match_modality in ('ven', 'dom', 'cub', 'pri')),
  skip_modality_prompt  boolean not null default false,
  -- prepared for future preferences without new migrations:
  notification_settings jsonb not null default '{}'::jsonb,
  theme                 text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- Policies (drop first for idempotency)
drop policy if exists "user_preferences_read_own" on public.user_preferences;
create policy "user_preferences_read_own" on public.user_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user_preferences_upsert_own" on public.user_preferences;
create policy "user_preferences_upsert_own" on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger: auto-update updated_at on every UPDATE
create or replace function public.update_user_preferences_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_preferences_timestamp on public.user_preferences;
create trigger trg_user_preferences_timestamp
  before update on public.user_preferences
  for each row execute function public.update_user_preferences_timestamp();

-- ROLLBACK:
-- drop table if exists public.user_preferences cascade;
