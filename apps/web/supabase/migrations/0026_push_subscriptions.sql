-- ============================================================
-- 0026 — Push Notification Subscriptions + Trigger
-- ============================================================

-- pg_net is required for the trigger to call the Edge Function.
create extension if not exists pg_net;

-- ─── Table ──────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  unique (user_id, endpoint)
);

create index if not exists idx_push_sub_user on public.push_subscriptions(user_id);

-- ─── RLS ────────────────────────────────────────────────────
alter table public.push_subscriptions enable row level security;

drop policy if exists push_sub_read_own   on public.push_subscriptions;
drop policy if exists push_sub_insert_own on public.push_subscriptions;
drop policy if exists push_sub_update_own on public.push_subscriptions;
drop policy if exists push_sub_delete_own on public.push_subscriptions;

create policy push_sub_read_own
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy push_sub_insert_own
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

-- Needed because /api/push/subscribe uses upsert(onConflict: user_id,endpoint).
-- Re-subscribing the same device triggers the UPDATE path; without this
-- policy the upsert fails with an RLS violation.
create policy push_sub_update_own
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_sub_delete_own
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ─── Trigger function ───────────────────────────────────────
-- Reads two secrets from Supabase Vault that Carlos creates once in the
-- Dashboard (Project Settings → Vault → Add new secret):
--   send_push_url      — Edge Function URL
--   service_role_key   — Service Role key (secret)
--
-- We avoid `ALTER DATABASE … SET` because Supabase managed Postgres does
-- not grant superuser to the SQL editor role. Vault encrypts secrets at
-- rest and is the supported pattern for trigger-side secrets.
--
-- Security-definer so the function can read vault.decrypted_secrets and
-- call net.http_post regardless of the row-inserter's privileges.

create or replace function public.notify_push_on_critical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url  text;
  v_key  text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'send_push_url' limit 1;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  -- Only fire for critical notification types and when BOTH secrets are
  -- configured. Without v_key the Edge Function would reject the call
  -- anyway (it validates the Bearer token), so skip the HTTP round-trip.
  if new.type in (
    'attest_requested',
    'match_confirmed',
    'match_disputed',
    'friend_request_received',
    'tournament_started'
  )
  and v_url is not null and v_url <> ''
  and v_key is not null and v_key <> '' then

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object(
        'notification_id', new.id,
        'user_id',         new.user_id
      )
    );

  end if;

  return new;
end;
$$;

-- ─── Trigger ────────────────────────────────────────────────
drop trigger if exists trg_push_critical on public.notifications;

create trigger trg_push_critical
  after insert on public.notifications
  for each row execute function public.notify_push_on_critical();

-- ============================================================
-- Carlos: create these two secrets once in the Supabase Dashboard:
--   Project Settings → Vault → "Add new secret"
--
--   Name: send_push_url
--   Secret: https://[YOUR_SUPABASE_REF].supabase.co/functions/v1/send-push-notification
--
--   Name: service_role_key
--   Secret: [YOUR_SUPABASE_SERVICE_ROLE_KEY]
--
-- Alternative (SQL editor, equivalent):
--   select vault.create_secret(
--     'https://[REF].supabase.co/functions/v1/send-push-notification',
--     'send_push_url'
--   );
--   select vault.create_secret('[SERVICE_ROLE_KEY]', 'service_role_key');
-- ============================================================
