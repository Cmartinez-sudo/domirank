'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';
import { requireOrgAdmin } from './auth';

// ─── Constants (shared with upload-actions.ts) ────────────────────────────────

const MAX_FILE_BYTES = 512_000; // 500 KB
const BUCKET = 'tournament-assets';
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

// ─── updateOrganization ───────────────────────────────────────────────────────

const UpdateOrgSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  contactEmail: z.string().trim().toLowerCase().email('Email inválido'),
  websiteUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      'El sitio web debe empezar con http:// o https://',
    ),
  brandPrimaryColor: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || /^#[0-9a-f]{6}$/i.test(v),
      'El color debe ser hex (ej. #0066cc)',
    ),
});

export type UpdateOrgResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Updates organization fields. Slug is NOT editable (would break URLs).
 * Logo upload goes via the separate uploadOrgAsset action.
 * Caller must be owner/admin of the org.
 */
export async function updateOrganization(input: unknown): Promise<UpdateOrgResult> {
  const parsed = UpdateOrgSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.', fieldErrors };
  }
  const data = parsed.data;

  const { org } = await requireOrgAdmin(data.orgSlug);
  const supabase = supabaseService();

  const { error: updErr } = await supabase
    .from('organizations')
    .update({
      name: data.name,
      description: data.description || null,
      contact_email: data.contactEmail,
      website_url: data.websiteUrl || null,
      brand_primary_color: data.brandPrimaryColor || null,
    })
    .eq('id', org.id);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${data.orgSlug}`);
  revalidatePath(`/admin/org/${data.orgSlug}/settings`);
  return { ok: true };
}

// ─── uploadOrgAsset ───────────────────────────────────────────────────────────

const UploadOrgAssetSchema = z.object({
  orgSlug: z.string().min(1),
  slot: z.enum(['logo']),
});

export type UploadResult = { ok: true; publicUrl: string } | { ok: false; error: string };

/**
 * Uploads an org logo to the shared `tournament-assets` bucket under
 * `org-logos/<slug>/<slot>-<timestamp>.<ext>`. Patches
 * organizations.logo_url with the public URL.
 *
 * Reuses the bucket (already public-read since mig 0085) to avoid
 * proliferating buckets. Path namespacing prevents conflicts between
 * orgs and between org/tournament assets.
 */
export async function uploadOrgAsset(formData: FormData): Promise<UploadResult> {
  const parsed = UploadOrgAssetSchema.safeParse({
    orgSlug: formData.get('orgSlug'),
    slot: formData.get('slot'),
  });
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Falta el archivo' };
  if (file.size === 0) return { ok: false, error: 'El archivo está vacío' };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `El archivo supera el límite de ${Math.floor(MAX_FILE_BYTES / 1024)} KB`,
    };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Tipo de archivo no soportado (${file.type}). Permitidos: PNG, JPG, WebP, SVG.`,
    };
  }

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const service = supabaseService();

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const safeExt = /^(png|jpe?g|webp|svg)$/i.test(ext) ? ext : 'png';
  const path = `org-logos/${org.slug}/${parsed.data.slot}-${Date.now()}.${safeExt}`;

  const { error: uploadErr } = await service.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadErr) return { ok: false, error: `Upload falló: ${uploadErr.message}` };

  const { data: publicData } = service.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  const column = parsed.data.slot === 'logo' ? 'logo_url' : null;
  if (!column) return { ok: false, error: 'Slot desconocido' };

  const { error: updErr } = await service
    .from('organizations')
    .update({ [column]: publicUrl })
    .eq('id', org.id);

  if (updErr) return { ok: false, error: `DB update falló: ${updErr.message}` };

  revalidatePath(`/admin/org/${org.slug}`);
  revalidatePath(`/admin/org/${org.slug}/settings`);
  return { ok: true, publicUrl };
}

// ─── clearOrgAsset ────────────────────────────────────────────────────────────

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Clears the org's logo_url (sets to NULL). Storage file is left orphan
 * for safety — a future cleanup job can prune.
 */
export async function clearOrgAsset(input: unknown): Promise<DeleteResult> {
  const parsed = UploadOrgAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const service = supabaseService();

  const column = parsed.data.slot === 'logo' ? 'logo_url' : null;
  if (!column) return { ok: false, error: 'Slot desconocido' };

  const { error: updErr } = await service
    .from('organizations')
    .update({ [column]: null })
    .eq('id', org.id);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${org.slug}`);
  revalidatePath(`/admin/org/${org.slug}/settings`);
  return { ok: true };
}
