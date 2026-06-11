'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireOrgAdmin } from './auth';
import { slugify, appendRandomSuffix } from './slug';

// ─── Validation schemas ───────────────────────────────────────────────────────

const PairInputSchema = z.object({
  playerAName: z.string().trim().min(1, 'Falta el nombre del jugador A').max(100),
  playerAEmail: z.string().trim().toLowerCase().email('Email A inválido'),
  playerBName: z.string().trim().min(1, 'Falta el nombre del jugador B').max(100),
  playerBEmail: z.string().trim().toLowerCase().email('Email B inválido'),
});

const CreateTournamentInputSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(150),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  prizeDescription: z.string().trim().max(500).optional().or(z.literal('')),
  scheduledStartAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Fecha inválida'),
  roundsCount: z.coerce.number().int().min(2).max(12),
  roundDurationMinutes: z.coerce.number().int().min(5).max(180),
  targetPoints: z.coerce.number().int().min(50).max(500),
  pairs: z.array(PairInputSchema).min(4, 'Mínimo 4 parejas para arrancar un torneo'),
});

export type CreateTournamentInput = z.infer<typeof CreateTournamentInputSchema>;
export type CreateTournamentResult =
  | { ok: true; tournamentId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ─── Internal helpers ─────────────────────────────────────────────────────────

const SLUG_RETRY_ATTEMPTS = 3;

/**
 * Validates that no email appears twice across all pairs.
 * Returns null if OK, or a short error string.
 */
function findDuplicateEmail(pairs: CreateTournamentInput['pairs']): string | null {
  const seen = new Set<string>();
  for (const pair of pairs) {
    for (const email of [pair.playerAEmail, pair.playerBEmail]) {
      if (seen.has(email)) return email;
      seen.add(email);
    }
  }
  return null;
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Creates a new tournament in `draft` status with all its pairs.
 *
 * Authorization: caller must be owner/admin of the org (RLS enforced
 * server-side; we also pre-check via requireOrgAdmin for fast-fail UX).
 *
 * Atomicity caveat: Supabase JS does not expose multi-statement
 * transactions to non-service-role clients. We insert the tournament
 * first, then the pairs. If the pairs insert fails, we delete the
 * tournament to avoid orphan rows. A future migration could wrap this
 * in a SECURITY DEFINER RPC for true atomicity.
 *
 * NEVER throws on validation/business errors — returns a discriminated
 * union the client can render. Re-throws on programmer errors.
 */
export async function createTournament(input: unknown): Promise<CreateTournamentResult> {
  const parsed = CreateTournamentInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      ok: false,
      error: 'Datos inválidos. Revisá el formulario.',
      fieldErrors,
    };
  }

  const data = parsed.data;

  const dupEmail = findDuplicateEmail(data.pairs);
  if (dupEmail) {
    return {
      ok: false,
      error: `El email "${dupEmail}" aparece en más de una pareja.`,
    };
  }

  const { org, user } = await requireOrgAdmin(data.orgSlug);
  const supabase = await supabaseServer();

  // Generate a display_slug. Retry on UNIQUE conflict by appending suffix.
  const baseSlug = slugify(data.name) || 'torneo';
  let tournamentId: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < SLUG_RETRY_ATTEMPTS; attempt++) {
    const candidateSlug = attempt === 0 ? baseSlug : appendRandomSuffix(baseSlug);

    const { data: inserted, error: insErr } = await supabase
      .from('org_tournaments')
      .insert({
        organization_id: org.id,
        name: data.name,
        description: data.description || null,
        prize_description: data.prizeDescription || null,
        scheduled_start_at: data.scheduledStartAt,
        format: 'swiss_pairs',
        rounds_count: data.roundsCount,
        round_duration_minutes: data.roundDurationMinutes,
        target_points: data.targetPoints,
        status: 'draft',
        display_slug: candidateSlug,
      })
      .select('id')
      .single();

    if (!insErr && inserted) {
      tournamentId = inserted.id;
      break;
    }
    // 23505 = unique_violation — retry with suffix.
    if (insErr?.code === '23505' && insErr.message.toLowerCase().includes('display_slug')) {
      lastError = insErr.message;
      continue;
    }
    return { ok: false, error: insErr?.message ?? 'Error desconocido al crear el torneo' };
  }

  if (!tournamentId) {
    return {
      ok: false,
      error: `No se pudo asignar un slug único después de ${SLUG_RETRY_ATTEMPTS} intentos: ${lastError}`,
    };
  }

  // Insert pairs.
  const pairRows = data.pairs.map((pair, index) => ({
    tournament_id: tournamentId!,
    player_a_name: pair.playerAName,
    player_a_email: pair.playerAEmail,
    player_b_name: pair.playerBName,
    player_b_email: pair.playerBEmail,
    initial_seed: index + 1,
  }));

  const { error: pairsErr } = await supabase.from('org_tournament_pairs').insert(pairRows);

  if (pairsErr) {
    // Rollback the tournament — best effort.
    await supabase.from('org_tournaments').delete().eq('id', tournamentId);
    return {
      ok: false,
      error: `Error al insertar parejas: ${pairsErr.message}. Tournament rollbacked.`,
    };
  }

  // Silence ts-unused-vars for `user` — kept around for future audit logging.
  void user;

  revalidatePath(`/admin/org/${data.orgSlug}`);
  return { ok: true, tournamentId };
}

/**
 * Convenience wrapper that creates the tournament and redirects to
 * the management screen on success. For use directly as a form action.
 *
 * On failure, throws so the client component can catch and render the
 * error (Server Actions error boundary).
 */
export async function createTournamentAndRedirect(input: unknown): Promise<never | CreateTournamentResult> {
  const result = await createTournament(input);
  if (!result.ok) return result;
  // Validate orgSlug is in input (already validated by createTournament).
  const orgSlug =
    typeof input === 'object' && input !== null && 'orgSlug' in input
      ? String((input as { orgSlug: unknown }).orgSlug)
      : '';
  redirect(`/admin/org/${orgSlug}/tournaments/${result.tournamentId}`);
}
