'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';
import { requireOrgAdmin } from './auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 512_000; // 500 KB
const BUCKET = 'tournament-assets';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

/**
 * Slot identifiers accepted by the tournament asset uploader.
 *
 * `logo` still maps to a single column on `org_tournaments`.
 *
 * `sponsor-<N>` (N = 1..12) targets the `tournament_sponsors` table
 * introduced in mig 0111. N is the 1-based `position` for the row. The
 * old `sponsor_1` / `sponsor_2` names are also accepted so any client
 * still round-tripping cached JS doesn't fail; they normalize to
 * `sponsor-1` / `sponsor-2`.
 */
const SPONSOR_SLOT_RE = /^sponsor-([1-9]|1[0-2])$/;
const LEGACY_SPONSOR_SLOT_RE = /^sponsor_([1-9]|1[0-2])$/;

function normalizeSlot(raw: string): string {
  const legacy = raw.match(LEGACY_SPONSOR_SLOT_RE);
  if (legacy) return `sponsor-${legacy[1]}`;
  return raw;
}

function parseSlot(raw: string):
  | { kind: 'logo' }
  | { kind: 'sponsor'; position: number }
  | null {
  if (raw === 'logo') return { kind: 'logo' };
  const m = raw.match(SPONSOR_SLOT_RE);
  if (m) return { kind: 'sponsor', position: Number(m[1]) };
  return null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UploadSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
  slot: z
    .string()
    .transform(normalizeSlot)
    .refine((s) => parseSlot(s) !== null, {
      message: 'Slot inválido — usá "logo" o "sponsor-<1..12>"',
    }),
});

const DeleteSchema = UploadSchema;

export type UploadResult = { ok: true; publicUrl: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads an image to the tournament-assets bucket and patches the
 * corresponding row (or column for `logo`). Uses service_role to write
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
  const slotSpec = parseSlot(parsed.data.slot);
  if (!slotSpec) return { ok: false, error: 'Slot inválido' };

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

  if (slotSpec.kind === 'logo') {
    const { error: updErr } = await service
      .from('org_tournaments')
      .update({ logo_url: publicUrl })
      .eq('id', parsed.data.tournamentId);
    if (updErr) return { ok: false, error: `DB update falló: ${updErr.message}` };
  } else {
    // Upsert the sponsor row at the given position. Using upsert so a
    // re-upload for the same slot replaces the URL cleanly instead of
    // hitting the UNIQUE (tournament_id, position) constraint.
    const { error: upsertErr } = await service
      .from('tournament_sponsors')
      .upsert(
        {
          tournament_id: parsed.data.tournamentId,
          position: slotSpec.position,
          logo_url: publicUrl,
        },
        { onConflict: 'tournament_id,position' },
      );
    if (upsertErr) return { ok: false, error: `DB update falló: ${upsertErr.message}` };
  }

  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/settings`);
  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/overview`);
  return { ok: true, publicUrl };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Clears the URL for a given slot:
 *   - `logo` → sets `org_tournaments.logo_url = NULL`
 *   - `sponsor-<N>` → deletes the row from `tournament_sponsors`
 *
 * Storage file is left orphan (cheap, and lets us restore easily if the
 * admin clicked by mistake). A future cron can prune unreferenced files.
 */
export async function clearTournamentAsset(input: unknown): Promise<DeleteResult> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };
  const slotSpec = parseSlot(parsed.data.slot);
  if (!slotSpec) return { ok: false, error: 'Slot inválido' };

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const service = supabaseService();

  if (slotSpec.kind === 'logo') {
    const { error: updErr } = await service
      .from('org_tournaments')
      .update({ logo_url: null })
      .eq('id', parsed.data.tournamentId)
      .eq('organization_id', org.id);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: delErr } = await service
      .from('tournament_sponsors')
      .delete()
      .eq('tournament_id', parsed.data.tournamentId)
      .eq('position', slotSpec.position);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/settings`);
  revalidatePath(`/admin/org/${org.slug}/tournaments/${parsed.data.tournamentId}/overview`);
  return { ok: true };
}
