'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';
import { requireOrgAdmin } from './auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 512_000; // 500 KB
const BUCKET = 'tournament-assets';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

// Maps the "slot" the admin is uploading to → DB column on org_tournaments.
const SLOT_TO_COLUMN: Record<string, 'logo_url' | 'sponsor_1_logo_url' | 'sponsor_2_logo_url'> = {
  logo: 'logo_url',
  sponsor_1: 'sponsor_1_logo_url',
  sponsor_2: 'sponsor_2_logo_url',
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const UploadSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
  slot: z.enum(['logo', 'sponsor_1', 'sponsor_2']),
});

const DeleteSchema = UploadSchema;

export type UploadResult = { ok: true; publicUrl: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads an image to the tournament-assets bucket and patches the
 * corresponding column on org_tournaments. Uses service_role to write
 * to Storage (the bucket can be public-read, but uploads require write
 * permissions that anon/authenticated don't have by default).
 *
 * Validations:
 *   - File size ≤ 500 KB.
 *   - MIME type in the allowed set (PNG, JPG, WebP, SVG).
 *   - Caller is owner/admin of the org.
 *
 * Storage path: `<orgSlug>/<tournamentId>/<slot>-<timestamp>.<ext>`
 * Old file (if any) is left in place — Storage doesn't bill aggressively
 * for orphans and keeping history is cheap. Future cleanup job can prune.
 */
export async function uploadTournamentAsset(formData: FormData): Promise<UploadResult> {
  const inputRaw = {
    orgSlug: formData.get('orgSlug'),
    tournamentId: formData.get('tournamentId'),
    slot: formData.get('slot'),
  };

  const parsed = UploadSchema.safeParse(inputRaw);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Falta el archivo' };
  if (file.size === 0) return { ok: false, error: 'El archivo está vacío' };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `El archivo supera el límite de ${Math.floor(MAX_FILE_BYTES / 1024)} KB` };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Tipo de archivo no soportado (${file.type}). Permitidos: PNG, JPG, WebP, SVG.`,
    };
  }

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const service = supabaseService();

  // Confirm the tournament belongs to this org (defense against IDOR).
  const { data: tournament } = await service
    .from('org_tournaments')
    .select('id')
    .eq('id', parsed.data.tournamentId)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) return { ok: false, error: 'Torneo no encontrado en esta organización' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const safeExt = /^(png|jpe?g|webp|svg)$/i.test(ext) ? ext : 'png';
  const path = `${org.slug}/${parsed.data.tournamentId}/${parsed.data.slot}-${Date.now()}.${safeExt}`;

  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return { ok: false, error: `Upload falló: ${uploadErr.message}` };
  }

  const { data: publicData } = service.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  const column = SLOT_TO_COLUMN[parsed.data.slot];
  const { error: updErr } = await service
    .from('org_tournaments')
    .update({ [column]: publicUrl })
    .eq('id', parsed.data.tournamentId);

  if (updErr) {
    return { ok: false, error: `DB update falló: ${updErr.message}` };
  }

  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/settings`);
  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/overview`);
  return { ok: true, publicUrl };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Clears the URL for a given slot. Does NOT delete the underlying file
 * from Storage — left as orphan for safety. A future cron can prune
 * unreferenced files.
 */
export async function clearTournamentAsset(input: unknown): Promise<DeleteResult> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const service = supabaseService();

  const column = SLOT_TO_COLUMN[parsed.data.slot];
  const { error: updErr } = await service
    .from('org_tournaments')
    .update({ [column]: null })
    .eq('id', parsed.data.tournamentId)
    .eq('organization_id', org.id);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/settings`);
  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/overview`);
  return { ok: true };
}
