'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireOrgAdmin } from './auth';
import { slugify, appendRandomSuffix } from './slug';
import { generateSwissPairings } from './generate-pairings';
import type { Pair, Match } from './swiss-types';

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
  const { data: round, error: roundErr } = await supabase
    .from('org_tournament_rounds')
    .insert({
      tournament_id: tournamentId,
      round_number: roundNumber,
      started_at: new Date().toISOString(),
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
  const target = tournament.target_points;
  const winnerScore = Math.max(parsed.data.pairHomeScore, parsed.data.pairAwayScore);
  if (winnerScore < target) {
    return {
      ok: false,
      error: `El ganador debe alcanzar la meta (${target} tantos). El máximo ingresado fue ${winnerScore}.`,
    };
  }

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
