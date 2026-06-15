-- ============================================================
-- 0085 — RLS policies for tournament-assets storage bucket
-- ============================================================
-- Context: bug report — el logo de la organización no se renderea
-- en el display público /t/[slug]. Causa más probable: el bucket
-- `tournament-assets` fue creado out-of-band via dashboard (mig 0084
-- línea 9) pero NO tiene policies RLS explícitas. Aunque el bucket
-- esté marcado "public" en el dashboard, sin la policy "select to
-- public" en storage.objects, anon SELECT puede ser bloqueado.
--
-- Fix: replicar el patrón de `avatars` (mig 0002) — public read,
-- authenticated write para uploads via uploadTournamentAsset que usa
-- service_role.
--
-- Idempotente: drop policy if exists + create.
-- ============================================================

drop policy if exists "tournament_assets_read_public" on storage.objects;
create policy "tournament_assets_read_public"
  on storage.objects for select to public
  using (bucket_id = 'tournament-assets');

-- INSERT/UPDATE/DELETE quedan restringidos por defecto. Las escrituras
-- pasan por uploadTournamentAsset / clearTournamentAsset que usan
-- supabaseService() (service_role) — bypassea RLS por diseño.
--
-- NOTE: skipped `comment on policy` because the migration role is not
-- owner of storage.objects (managed by Supabase platform). Policy was
-- created successfully; the comment is purely documentation.

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Policy exists:
--      select polname from pg_policy
--       where polrelid = 'storage.objects'::regclass
--         and polname = 'tournament_assets_read_public';
--    Expected: 1 row.
--
-- 2. Anon SELECT works against a known file:
--    (replace <some-uploaded-path> with an actual path from the bucket)
--      curl -I https://<project>.supabase.co/storage/v1/object/public/tournament-assets/<some-uploaded-path>
--    Expected: HTTP 200, not 403/404.
-- ============================================================
