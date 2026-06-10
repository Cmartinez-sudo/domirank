import { computeStandings } from './compute-standings';
import type {
  Pair,
  Match,
  PairStanding,
  RoundPairingResult,
  SwissPairingInput,
  TablePairing,
  Tiebreaker,
} from './swiss-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a Set of "already-played" keys from previous matches.
 * Key format is `minId|maxId` — order-independent.
 */
function buildPlayedSet(matches: Match[]): Set<string> {
  const played = new Set<string>();
  for (const match of matches) {
    if (match.pairAwayId === null) continue; // bye, not a real opponent
    const a = match.pairHomeId < match.pairAwayId ? match.pairHomeId : match.pairAwayId;
    const b = match.pairHomeId < match.pairAwayId ? match.pairAwayId : match.pairHomeId;
    played.add(`${a}|${b}`);
  }
  return played;
}

function matchKey(idA: string, idB: string): string {
  const a = idA < idB ? idA : idB;
  const b = idA < idB ? idB : idA;
  return `${a}|${b}`;
}

/**
 * Compares two standings for sort order (descending).
 * Primary sort: points DESC.
 * Secondary sort: depends on the configured tiebreaker.
 * Tertiary sort: marginOfVictory DESC (when tiebreaker != margin_of_victory).
 * Final tiebreak: pair.id ASC — guarantees determinism even when all metrics tie.
 */
function compareStandings(
  a: PairStanding,
  b: PairStanding,
  tiebreaker: Tiebreaker,
): number {
  if (b.points !== a.points) return b.points - a.points;

  // Primary tiebreaker
  if (tiebreaker === 'margin_of_victory') {
    if (b.marginOfVictory !== a.marginOfVictory) return b.marginOfVictory - a.marginOfVictory;
    // Secondary: buchholz
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
  } else if (tiebreaker === 'buchholz') {
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    // Secondary: marginOfVictory
    if (b.marginOfVictory !== a.marginOfVictory) return b.marginOfVictory - a.marginOfVictory;
  } else {
    // head_to_head: check direct result between the two; if no direct match, fall back to margin
    const aVsB = a.headToHeadResults.get(b.pairId);
    if (aVsB === 'win') return -1; // a ranks higher
    if (aVsB === 'loss') return 1; // b ranks higher
    // draw or no direct match → fall back to marginOfVictory then buchholz
    if (b.marginOfVictory !== a.marginOfVictory) return b.marginOfVictory - a.marginOfVictory;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
  }

  // Final deterministic tiebreak: pair.id ASC (lower UUID = higher rank when tied)
  return a.pairId < b.pairId ? -1 : 1;
}

// ─── Round-1 seed sort ─────────────────────────────────────────────────────────

/**
 * Sorts pairs for Round 1 by initial_seed ASC; pairs without a seed are ordered
 * by id ASC for determinism.
 */
function sortByInitialSeed(pairs: Pair[]): Pair[] {
  return [...pairs].sort((a, b) => {
    const sa = a.initialSeed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.initialSeed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id < b.id ? -1 : 1;
  });
}

// ─── Greedy pairing with fallback ─────────────────────────────────────────────

/**
 * Pairs the ordered list of active pairs top-down.
 * For each unmatched pair i, finds the first unmatched pair j > i that has
 * NOT previously played i.  If no such j exists, uses the nearest available j
 * (forced rematch) and records a warning.
 */
function greedyPair(
  orderedIds: string[],
  playedSet: Set<string>,
): { pairings: Array<[string, string]>; warnings: string[] } {
  const used = new Set<string>();
  const pairings: Array<[string, string]> = [];
  const warnings: string[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const idA = orderedIds[i];
    if (used.has(idA)) continue;

    // Try to find a partner that hasn't played idA
    let partnerId: string | null = null;
    for (let j = i + 1; j < orderedIds.length; j++) {
      const idB = orderedIds[j];
      if (used.has(idB)) continue;
      if (!playedSet.has(matchKey(idA, idB))) {
        partnerId = idB;
        break;
      }
    }

    // Fallback: forced rematch — take the first available
    if (partnerId === null) {
      for (let j = i + 1; j < orderedIds.length; j++) {
        const idB = orderedIds[j];
        if (!used.has(idB)) {
          partnerId = idB;
          warnings.push(`fallback used: rematch forced between ${idA} and ${idB}`);
          break;
        }
      }
    }

    if (partnerId !== null) {
      pairings.push([idA, partnerId]);
      used.add(idA);
      used.add(partnerId);
    }
  }

  return { pairings, warnings };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates Swiss pairings for a given round.
 *
 * Round 1 logic: pairs sorted by initial_seed ASC, paired 1v2, 3v4, …
 * Round ≥ 2 logic: pairs sorted by standings DESC (points → tiebreaker → margin
 *   → buchholz → pair.id for determinism), then greedy pairing with rematch
 *   avoidance.
 *
 * The function is pure — no side effects, no DB access.  The caller is
 * responsible for persisting the output to org_tournament_matches.
 */
export function generateSwissPairings(input: SwissPairingInput): RoundPairingResult {
  const { pairs, previousMatches, roundNumber, tiebreaker } = input;
  const warnings: string[] = [];

  // 1. Filter to active (non-withdrawn) pairs.
  const activePairs = pairs.filter((p) => p.withdrawnAt === null);

  // 2. Determine bye candidate before sorting so we can remove it from the list.
  let byePairId: string | null = null;
  let pairsForMatching = activePairs;

  if (activePairs.length % 2 === 1) {
    // Need to assign a bye.
    // Build standings-ordered list (best → worst) to find the lowest-ranked
    // pair that has not yet received a bye.
    const standings = roundNumber === 1 ? [] : computeStandings(pairs, previousMatches);
    const standingMap = new Map(standings.map((s) => [s.pairId, s]));

    // Sort active pairs best → worst using the configured tiebreaker.
    const bestToWorst: Pair[] = roundNumber === 1
      ? sortByInitialSeed(activePairs)
      : [...activePairs].sort((a, b) => {
          const sa = standingMap.get(a.id);
          const sb = standingMap.get(b.id);
          if (!sa || !sb) return a.id < b.id ? -1 : 1;
          return compareStandings(sa, sb, tiebreaker);
        });

    // Walk from worst (last) to best (first) to find a pair without a prior bye.
    let byeCandidate: Pair | null = null;
    for (let i = bestToWorst.length - 1; i >= 0; i--) {
      const candidate = bestToWorst[i];
      const s = standingMap.get(candidate.id);
      const hasBye = s ? s.hasHadBye : false;
      if (!hasBye) {
        byeCandidate = candidate;
        break;
      }
    }
    // Fallback: everyone has had a bye — assign to the lowest-ranked pair.
    byeCandidate ??= bestToWorst[bestToWorst.length - 1];

    byePairId = byeCandidate.id;
    pairsForMatching = activePairs.filter((p) => p.id !== byePairId);
  }

  // 3. Sort pairs for pairing.
  let orderedIds: string[];

  if (roundNumber === 1) {
    orderedIds = sortByInitialSeed(pairsForMatching).map((p) => p.id);
  } else {
    const standings = computeStandings(pairs, previousMatches);
    const standingMap = new Map(standings.map((s) => [s.pairId, s]));

    orderedIds = [...pairsForMatching]
      .sort((a, b) => {
        const sa = standingMap.get(a.id);
        const sb = standingMap.get(b.id);
        if (!sa || !sb) return a.id < b.id ? -1 : 1;
        return compareStandings(sa, sb, tiebreaker);
      })
      .map((p) => p.id);
  }

  // 4. Greedy pairing.
  const playedSet = buildPlayedSet(previousMatches);
  const { pairings: rawPairings, warnings: pairingWarnings } = greedyPair(
    orderedIds,
    playedSet,
  );
  warnings.push(...pairingWarnings);

  // 5. Assign table numbers (1-indexed).
  const tablePairings: TablePairing[] = rawPairings.map(([homeId, awayId], index) => ({
    tableNumber: index + 1,
    pairHomeId: homeId,
    pairAwayId: awayId,
  }));

  return {
    pairings: tablePairings,
    byePairId,
    warnings,
  };
}
