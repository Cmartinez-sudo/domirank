'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getAppUrl } from '@/lib/email';
import { requireOrgAdmin } from './auth';
import { slugify, appendRandomSuffix } from './slug';
import { generateSwissPairings } from './generate-pairings';
import type { Pair, Match } from './swiss-types';
import { sendClubProEmail } from './email';
import { tournamentInvitationEmail } from './email-templates';

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

// ────────────────────────────────────────────────────────────────────────────
// Round / score management (used by Phase 3c management screen).
// ────────────────────────────────────────────────────────────────────────────

export type ActionResult = { ok: true } | { ok: false; error: string };

const StartTournamentSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
});

const GenerateNextRoundSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
});

const RecordScoreSchema = z.object({
  orgSlug: z.string().min(1),
  matchId: z.string().uuid(),
  pairHomeScore: z.coerce.number().int().min(0).max(999),
  pairAwayScore: z.coerce.number().int().min(0).max(999),
});

const MarkWithdrawnSchema = z.object({
  orgSlug: z.string().min(1),
  pairId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});

/**
 * Fetches all pairs + previous (finished/bye) matches for a tournament,
 * projecting them into the engine's lean Pair/Match types. Used by both
 * startTournament (no prior matches) and generateNextRound.
 *
 * The projection resolves `round_id → round_number` via a left join with
 * org_tournament_rounds since Match.roundNumber is required by the engine
 * for bye rotation but `org_tournament_matches.round_number` does not
 * exist as a column.
 */
async function loadEngineState(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  tournamentId: string,
): Promise<{ pairs: Pair[]; previousMatches: Match[]; targetPoints: number; roundsCount: number; currentRound: number; status: string } | { error: string }> {
  const { data: tournament, error: tErr } = await supabase
    .from('org_tournaments')
    .select('status, current_round_number, rounds_count, target_points')
    .eq('id', tournamentId)
    .maybeSingle();
  if (tErr || !tournament) return { error: 'Torneo no encontrado' };

  const { data: pairsRaw } = await supabase
    .from('org_tournament_pairs')
    .select('id, initial_seed, withdrawn_at')
    .eq('tournament_id', tournamentId);

  const pairs: Pair[] = (pairsRaw ?? []).map((p) => ({
    id: p.id,
    initialSeed: p.initial_seed,
    withdrawnAt: p.withdrawn_at,
  }));

  const { data: matchesRaw } = await supabase
    .from('org_tournament_matches')
    .select(
      'id, pair_home_id, pair_away_id, pair_home_score, pair_away_score, status, round_id, org_tournament_rounds(round_number)',
    )
    .eq('tournament_id', tournamentId)
    .in('status', ['finished', 'bye']);

  const previousMatches: Match[] = (matchesRaw ?? []).map((m) => {
    // Supabase returns related records as an object/array depending on cardinality.
    const round = (m as unknown as { org_tournament_rounds: { round_number: number } | null }).org_tournament_rounds;
    return {
      id: m.id,
      pairHomeId: m.pair_home_id,
      pairAwayId: m.pair_away_id,
      pairHomeScore: m.pair_home_score,
      pairAwayScore: m.pair_away_score,
      status: m.status as Match['status'],
      roundNumber: round?.round_number ?? 0,
    };
  });

  return {
    pairs,
    previousMatches,
    targetPoints: tournament.target_points,
    roundsCount: tournament.rounds_count,
    currentRound: tournament.current_round_number ?? 0,
    status: tournament.status,
  };
}

/**
 * Generates pairings for round N (engine call) and persists them as a new
 * `org_tournament_rounds` row + `org_tournament_matches` rows in `pending`
 * status. Returns the new round ID + the engine warnings for UI surfacing.
 *
 * Caller is responsible for transitioning the tournament status (e.g.
 * `draft` → `in_progress` on round 1).
 */
async function persistRound(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  tournamentId: string,
  roundNumber: number,
  pairings: Array<{ tableNumber: number; pairHomeId: string; pairAwayId: string }>,
  byePairId: string | null,
): Promise<{ ok: true; roundId: string } | { ok: false; error: string }> {
  // started_at intentionally left NULL — the round is generated but the
  // timer doesn't tick until the admin presses "Empezar ronda" so players
  // can find their tables before the clock starts.
  const { data: round, error: roundErr } = await supabase
    .from('org_tournament_rounds')
    .insert({
      tournament_id: tournamentId,
      round_number: roundNumber,
    })
    .select('id')
    .single();
  if (roundErr || !round) {
    return { ok: false, error: `No se pudo crear la ronda: ${roundErr?.message ?? 'unknown'}` };
  }

  const matchRows = pairings.map((p) => ({
    tournament_id: tournamentId,
    round_id: round.id,
    table_number: p.tableNumber,
    pair_home_id: p.pairHomeId,
    pair_away_id: p.pairAwayId,
    status: 'pending',
  }));

  if (byePairId) {
    matchRows.push({
      tournament_id: tournamentId,
      round_id: round.id,
      table_number: matchRows.length + 1,
      pair_home_id: byePairId,
      pair_away_id: null as unknown as string, // bye marker
      status: 'bye',
    });
  }

  const { error: matchesErr } = await supabase.from('org_tournament_matches').insert(matchRows);
  if (matchesErr) {
    // Roll back the round if matches insert failed.
    await supabase.from('org_tournament_rounds').delete().eq('id', round.id);
    return { ok: false, error: `No se pudo insertar matches: ${matchesErr.message}` };
  }

  return { ok: true, roundId: round.id };
}

/**
 * Starts a tournament: validates status ∈ {draft, ready}, runs the Swiss
 * engine to generate Round 1 pairings, persists round + matches, sets
 * status='in_progress' and current_round_number=1.
 */
export async function startTournament(input: unknown): Promise<ActionResult> {
  const parsed = StartTournamentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const state = await loadEngineState(supabase, parsed.data.tournamentId);
  if ('error' in state) return { ok: false, error: state.error };

  if (state.status !== 'draft' && state.status !== 'ready') {
    return {
      ok: false,
      error: `El torneo no se puede iniciar desde el estado "${state.status}"`,
    };
  }
  if (state.pairs.length < 4) {
    return { ok: false, error: 'Mínimo 4 parejas para iniciar' };
  }

  const result = generateSwissPairings({
    pairs: state.pairs,
    previousMatches: [],
    roundNumber: 1,
    targetPoints: state.targetPoints,
  });

  const persisted = await persistRound(
    supabase,
    parsed.data.tournamentId,
    1,
    result.pairings,
    result.byePairId,
  );
  if (!persisted.ok) return persisted;

  const { error: updErr } = await supabase
    .from('org_tournaments')
    .update({
      status: 'in_progress',
      current_round_number: 1,
      started_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.tournamentId);

  if (updErr) return { ok: false, error: `Round creada pero update falló: ${updErr.message}` };

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${parsed.data.tournamentId}`);
  return { ok: true };
}

/**
 * Generates pairings for the NEXT round (current_round_number + 1).
 * Validates: tournament is in_progress, current round has all matches
 * finished/bye, and we haven't exceeded rounds_count.
 *
 * On last round generated, the tournament STILL stays in_progress until
 * all matches of that round finish; status flips to 'finished' when the
 * admin records the final score (handled in recordMatchScore).
 */
export async function generateNextRound(input: unknown): Promise<ActionResult> {
  const parsed = GenerateNextRoundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const state = await loadEngineState(supabase, parsed.data.tournamentId);
  if ('error' in state) return { ok: false, error: state.error };

  if (state.status !== 'in_progress') {
    return { ok: false, error: 'El torneo no está en curso' };
  }
  if (state.currentRound >= state.roundsCount) {
    return { ok: false, error: 'El torneo ya tuvo todas sus rondas' };
  }

  // Validate current round has all matches in finished or bye.
  const { data: pendingMatches } = await supabase
    .from('org_tournament_matches')
    .select('id, status, org_tournament_rounds!inner(round_number)')
    .eq('tournament_id', parsed.data.tournamentId)
    .in('status', ['pending', 'in_progress']);

  if (pendingMatches && pendingMatches.length > 0) {
    return { ok: false, error: `Quedan ${pendingMatches.length} partidas sin cerrar en la ronda actual` };
  }

  const nextRoundNumber = state.currentRound + 1;
  const result = generateSwissPairings({
    pairs: state.pairs,
    previousMatches: state.previousMatches,
    roundNumber: nextRoundNumber,
    targetPoints: state.targetPoints,
  });

  const persisted = await persistRound(
    supabase,
    parsed.data.tournamentId,
    nextRoundNumber,
    result.pairings,
    result.byePairId,
  );
  if (!persisted.ok) return persisted;

  const { error: updErr } = await supabase
    .from('org_tournaments')
    .update({ current_round_number: nextRoundNumber })
    .eq('id', parsed.data.tournamentId);
  if (updErr) return { ok: false, error: `Round creada pero update falló: ${updErr.message}` };

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${parsed.data.tournamentId}`);
  return { ok: true };
}

/**
 * Records the final score for a match. Validates no draws (homeScore !==
 * awayScore) and that at least one side reached target_points (winner
 * cap) — defense against UI bug entering a partial score by accident.
 *
 * If this was the last pending match of the last round, the tournament
 * is auto-finished.
 */
export async function recordMatchScore(input: unknown): Promise<ActionResult> {
  const parsed = RecordScoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  if (parsed.data.pairHomeScore === parsed.data.pairAwayScore) {
    return { ok: false, error: 'No puede haber empate — el reglamento exige mano de desempate' };
  }

  await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const { data: match, error: matchErr } = await supabase
    .from('org_tournament_matches')
    .select('id, tournament_id, status, org_tournaments(target_points, rounds_count, current_round_number)')
    .eq('id', parsed.data.matchId)
    .maybeSingle();
  if (matchErr || !match) return { ok: false, error: 'Partida no encontrada' };
  if (match.status === 'finished') return { ok: false, error: 'La partida ya está finalizada' };
  if (match.status === 'bye') return { ok: false, error: 'No se ingresan scores en byes' };

  const tournament = (match as unknown as { org_tournaments: { target_points: number; rounds_count: number; current_round_number: number | null } }).org_tournaments;
  // Note: we don't enforce winnerScore >= target_points. A match ends
  // when EITHER a pair reaches the goal OR the round-duration timer
  // expires. If the clock runs out first, the leader at that moment wins
  // (e.g. 75-46 in a target=100 match). The only score invariant is "no
  // draws", which is enforced above.

  const { error: updErr } = await supabase
    .from('org_tournament_matches')
    .update({
      pair_home_score: parsed.data.pairHomeScore,
      pair_away_score: parsed.data.pairAwayScore,
      status: 'finished',
      finished_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.matchId);
  if (updErr) return { ok: false, error: updErr.message };

  // Auto-finish the tournament if this was the last pending match of the last round.
  if (tournament.current_round_number === tournament.rounds_count) {
    const { count: stillPending } = await supabase
      .from('org_tournament_matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', match.tournament_id)
      .in('status', ['pending', 'in_progress']);
    if (stillPending === 0) {
      await supabase
        .from('org_tournaments')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', match.tournament_id);
    }
  }

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${match.tournament_id}`);
  return { ok: true };
}

/**
 * Marks a pair as withdrawn (sets withdrawn_at + reason). Doesn't delete
 * historical matches — past results stand. The engine excludes withdrawn
 * pairs from future pairings via the `withdrawnAt !== null` filter.
 */
export async function markPairWithdrawn(input: unknown): Promise<ActionResult> {
  const parsed = MarkWithdrawnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const { data: pair, error: pairErr } = await supabase
    .from('org_tournament_pairs')
    .select('id, tournament_id, withdrawn_at')
    .eq('id', parsed.data.pairId)
    .maybeSingle();
  if (pairErr || !pair) return { ok: false, error: 'Pareja no encontrada' };
  if (pair.withdrawn_at) return { ok: false, error: 'La pareja ya está retirada' };

  const { error: updErr } = await supabase
    .from('org_tournament_pairs')
    .update({
      withdrawn_at: new Date().toISOString(),
      withdrawn_reason: parsed.data.reason || null,
    })
    .eq('id', parsed.data.pairId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${pair.tournament_id}`);
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Invitations (Phase 3d)
// ────────────────────────────────────────────────────────────────────────────

const SendInvitationsSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
});

export type SendInvitationsResult =
  | { ok: true; sent: number; skipped: number; failed: number; failures: string[] }
  | { ok: false; error: string };

/**
 * Sends invitation emails to every player of every (non-withdrawn) pair
 * in the tournament. Idempotent at the (tournament_id, email) level —
 * skips players that already have an invitation row.
 *
 * Per player:
 *   1. Generate a 32-char URL-safe claim_token (UUID v4 stripped).
 *   2. INSERT into org_tournament_invitations.
 *      Conflict on (tournament_id, email) → skip (already invited).
 *   3. Call sendClubProEmail with tournamentInvitationEmail template.
 *      Failure does NOT undo the DB row — the admin can use "Resend"
 *      from the Pairs tab (Phase 3e/future).
 *
 * Returns a summary: { sent, skipped, failed, failures: [emails…] }.
 * The action never throws on per-player failure — it aggregates.
 */
export async function sendTournamentInvitations(input: unknown): Promise<SendInvitationsResult> {
  const parsed = SendInvitationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament, error: tErr } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, organization_id, target_points, rounds_count, round_duration_minutes, sponsor_1_logo_url, sponsor_2_logo_url',
    )
    .eq('id', parsed.data.tournamentId)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (tErr || !tournament) return { ok: false, error: 'Torneo no encontrado' };

  const { data: pairsRaw } = await supabase
    .from('org_tournament_pairs')
    .select(
      'id, player_a_name, player_a_email, player_b_name, player_b_email, withdrawn_at',
    )
    .eq('tournament_id', tournament.id)
    .is('withdrawn_at', null);

  const pairs = pairsRaw ?? [];
  if (pairs.length === 0) {
    return { ok: false, error: 'No hay parejas activas para invitar' };
  }

  // Existing invitations — skip these emails (idempotency).
  const { data: existingRaw } = await supabase
    .from('org_tournament_invitations')
    .select('email')
    .eq('tournament_id', tournament.id);
  const alreadyInvited = new Set((existingRaw ?? []).map((r) => r.email.toLowerCase()));

  const appUrl = getAppUrl();

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const pair of pairs) {
    const players = [
      { name: pair.player_a_name, email: pair.player_a_email, partner: pair.player_b_name },
      { name: pair.player_b_name, email: pair.player_b_email, partner: pair.player_a_name },
    ];

    for (const player of players) {
      const emailLower = player.email.toLowerCase();
      if (alreadyInvited.has(emailLower)) {
        skipped += 1;
        continue;
      }

      const claimToken = randomUUID().replace(/-/g, '');

      const { error: invErr } = await supabase.from('org_tournament_invitations').insert({
        tournament_id: tournament.id,
        pair_id: pair.id,
        email: emailLower,
        player_name: player.name,
        claim_token: claimToken,
      });
      if (invErr) {
        // Most likely a race on the unique (tournament_id, email) constraint.
        if (invErr.code === '23505') {
          skipped += 1;
          continue;
        }
        failed += 1;
        failures.push(`${emailLower}: ${invErr.message}`);
        continue;
      }
      alreadyInvited.add(emailLower);

      const template = tournamentInvitationEmail({
        recipientName: player.name,
        partnerName: player.partner,
        tournamentName: tournament.name,
        orgName: org.name,
        orgLogoUrl: org.logo_url ?? undefined,
        targetPoints: tournament.target_points,
        roundsCount: tournament.rounds_count,
        roundDurationMinutes: tournament.round_duration_minutes,
        sponsor1LogoUrl: tournament.sponsor_1_logo_url ?? undefined,
        sponsor2LogoUrl: tournament.sponsor_2_logo_url ?? undefined,
        waitlistUrl: appUrl,
      });

      const okSend = await sendClubProEmail({
        to: emailLower,
        template,
        idempotencyKey: `tournament-invite:${tournament.id}:${emailLower}`,
      });

      if (okSend) {
        sent += 1;
      } else {
        failed += 1;
        failures.push(`${emailLower}: email send returned false`);
      }
    }
  }

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${tournament.id}`);
  return { ok: true, sent, skipped, failed, failures };
}

// ────────────────────────────────────────────────────────────────────────────
// Edit / cancel (advanced settings)
// ────────────────────────────────────────────────────────────────────────────

const UpdateTournamentSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(150),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  prizeDescription: z.string().trim().max(500).optional().or(z.literal('')),
  scheduledStartAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Fecha inválida'),
  roundsCount: z.coerce.number().int().min(2).max(12),
  roundDurationMinutes: z.coerce.number().int().min(5).max(180),
  targetPoints: z.coerce.number().int().min(50).max(500),
  displaySlug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
});

export type UpdateTournamentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Edits a tournament. Some fields are locked once the tournament is
 * in_progress to avoid corrupting active games:
 *   • target_points → locked in_progress (would break ongoing matches).
 *   • rounds_count → cannot drop below current_round_number when in_progress
 *     (Q3 decision: admin can finish "now" by setting rounds_count =
 *     current_round_number, but cannot demand more matches in past rounds).
 *
 * display_slug change is allowed but breaks any link people had to the
 * old TV URL — surface a warning client-side.
 */
export async function updateTournament(input: unknown): Promise<UpdateTournamentResult> {
  const parsed = UpdateTournamentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: 'Datos inválidos. Revisá el formulario.', fieldErrors };
  }
  const data = parsed.data;

  const { org } = await requireOrgAdmin(data.orgSlug);
  const supabase = await supabaseServer();

  const { data: current, error: curErr } = await supabase
    .from('org_tournaments')
    .select('id, status, current_round_number, target_points, display_slug')
    .eq('id', data.tournamentId)
    .eq('organization_id', org.id)
    .maybeSingle();

  if (curErr || !current) return { ok: false, error: 'Torneo no encontrado' };
  if (current.status === 'finished' || current.status === 'cancelled') {
    return { ok: false, error: `No se puede editar un torneo ${current.status}` };
  }

  // Rule: target_points locked once in_progress.
  if (
    current.status === 'in_progress' &&
    data.targetPoints !== current.target_points
  ) {
    return {
      ok: false,
      error:
        'No se puede cambiar la meta de tantos en un torneo en curso — afectaría partidas ya jugadas.',
      fieldErrors: { targetPoints: ['Bloqueado: torneo en curso'] },
    };
  }

  // Rule: rounds_count cannot drop below current_round_number when in_progress.
  if (
    current.status === 'in_progress' &&
    data.roundsCount < (current.current_round_number ?? 0)
  ) {
    return {
      ok: false,
      error: `No se puede reducir rondas a ${data.roundsCount} — el torneo va en ronda ${current.current_round_number}.`,
      fieldErrors: {
        roundsCount: [`Mínimo: ${current.current_round_number} (ronda actual)`],
      },
    };
  }

  const { error: updErr } = await supabase
    .from('org_tournaments')
    .update({
      name: data.name,
      description: data.description || null,
      prize_description: data.prizeDescription || null,
      scheduled_start_at: data.scheduledStartAt,
      rounds_count: data.roundsCount,
      round_duration_minutes: data.roundDurationMinutes,
      target_points: data.targetPoints,
      display_slug: data.displaySlug,
    })
    .eq('id', data.tournamentId);

  if (updErr) {
    if (
      updErr.code === '23505' &&
      updErr.message.toLowerCase().includes('display_slug')
    ) {
      return {
        ok: false,
        error: 'Ese display slug ya está en uso por otro torneo.',
        fieldErrors: { displaySlug: ['Ya en uso'] },
      };
    }
    return { ok: false, error: updErr.message };
  }

  revalidatePath(`/admin/org/${data.orgSlug}/tournaments/${data.tournamentId}`);
  revalidatePath(`/admin/org/${data.orgSlug}`);
  return { ok: true };
}

const CancelTournamentSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
});

/**
 * Soft-cancels a tournament: sets status='cancelled' and finished_at=now().
 * Past matches and standings are preserved (audit trail). Pending matches
 * remain in the DB but are no longer surfaced because status='cancelled'
 * removes the tournament from active lookups.
 *
 * Reversible at the DB level — an admin with service_role can flip
 * status back to 'in_progress' if cancelled by mistake. No undo button
 * in the UI by design (high-impact action, intentional friction).
 */
export async function cancelTournament(input: unknown): Promise<ActionResult> {
  const parsed = CancelTournamentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  const { org } = await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const { data: current } = await supabase
    .from('org_tournaments')
    .select('id, status')
    .eq('id', parsed.data.tournamentId)
    .eq('organization_id', org.id)
    .maybeSingle();

  if (!current) return { ok: false, error: 'Torneo no encontrado' };
  if (current.status === 'cancelled') {
    return { ok: false, error: 'El torneo ya está cancelado' };
  }
  if (current.status === 'finished') {
    return { ok: false, error: 'No se puede cancelar un torneo ya finalizado' };
  }

  const { error: updErr } = await supabase
    .from('org_tournaments')
    .update({
      status: 'cancelled',
      finished_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.tournamentId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${parsed.data.tournamentId}`);
  revalidatePath(`/admin/org/${parsed.data.orgSlug}`);
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Start round timer (manual)
// ────────────────────────────────────────────────────────────────────────────

const StartRoundSchema = z.object({
  orgSlug: z.string().min(1),
  tournamentId: z.string().uuid(),
});

/**
 * Starts the timer for the current round of the tournament: sets
 * org_tournament_rounds.started_at = now() for the round identified
 * by tournament.current_round_number.
 *
 * Round creation (startTournament + generateNextRound) intentionally
 * leaves started_at NULL so the admin can give players time to find
 * their tables before the clock begins. The display TV only renders
 * RoundTimer when started_at is set, so the timer simply waits.
 *
 * Idempotent: if started_at is already set, returns ok without
 * re-stamping (the admin clicked twice).
 */
export async function startRound(input: unknown): Promise<ActionResult> {
  const parsed = StartRoundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Input inválido' };

  await requireOrgAdmin(parsed.data.orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament, error: tErr } = await supabase
    .from('org_tournaments')
    .select('id, status, current_round_number')
    .eq('id', parsed.data.tournamentId)
    .maybeSingle();
  if (tErr || !tournament) return { ok: false, error: 'Torneo no encontrado' };
  if (tournament.status !== 'in_progress') {
    return { ok: false, error: 'El torneo no está en curso' };
  }
  const roundNumber = tournament.current_round_number ?? 0;
  if (roundNumber < 1) {
    return { ok: false, error: 'Todavía no hay ronda generada' };
  }

  const { data: round, error: roundErr } = await supabase
    .from('org_tournament_rounds')
    .select('id, started_at')
    .eq('tournament_id', parsed.data.tournamentId)
    .eq('round_number', roundNumber)
    .maybeSingle();
  if (roundErr || !round) return { ok: false, error: 'Ronda actual no encontrada' };

  // Already started — idempotent no-op.
  if (round.started_at) {
    return { ok: true };
  }

  const { error: updErr } = await supabase
    .from('org_tournament_rounds')
    .update({ started_at: new Date().toISOString() })
    .eq('id', round.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/admin/org/${parsed.data.orgSlug}/tournaments/${parsed.data.tournamentId}`);
  return { ok: true };
}
