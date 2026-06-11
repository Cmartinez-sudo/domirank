import { computeStandings } from './compute-standings';
import type {
  Pair,
  Match,
  PairStanding,
  RoundPairingResult,
  SwissPairingInput,
  TablePairing,
} from './swiss-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPlayedSet(matches: Match[]): Set<string> {
  const played = new Set<string>();
  for (const match of matches) {
    if (match.pairAwayId === null) continue;
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
 * Standings comparator for dominó federado.
 * Sort order (DESC unless noted):
 *   1. wins
 *   2. effectivenessCoefficient
 *   3. pointsScored
 *   4. head-to-head (only between these two pairs)
 *   5. pair.id ASC (final deterministic tiebreak)
 */
function compareStandings(a: PairStanding, b: PairStanding): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.effectivenessCoefficient !== b.effectivenessCoefficient) {
    return b.effectivenessCoefficient - a.effectivenessCoefficient;
  }
  if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;

  const aVsB = a.headToHeadResults.get(b.pairId);
  if (aVsB === 'win') return -1;
  if (aVsB === 'loss') return 1;

  return a.pairId < b.pairId ? -1 : 1;
}

function sortByInitialSeed(pairs: Pair[]): Pair[] {
  return [...pairs].sort((a, b) => {
    const sa = a.initialSeed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.initialSeed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * Greedy pairing — for each unmatched pair i (top-down), find the first
 * unmatched j > i that has NOT played i. Falls back to forced rematch with
 * a warning if no such j exists.
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

    let partnerId: string | null = null;
    for (let j = i + 1; j < orderedIds.length; j++) {
      const idB = orderedIds[j];
      if (used.has(idB)) continue;
      if (!playedSet.has(matchKey(idA, idB))) {
        partnerId = idB;
        break;
      }
    }

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
 * Generates Swiss pairings for a given round in a dominó federado tournament.
 *
 * Round 1: sorted by initial_seed ASC (id ASC for nulls/ties), paired 1v2, 3v4...
 * Round ≥ 2: sorted by wins → CE → pointsScored → h2h → pair.id, then greedy
 *   pairing with rematch avoidance.
 *
 * Bye (odd N):
 *   1. Lowest-ranked pair that has NOT had a bye yet.
 *   2. If all have had a bye → strict rotation: pair with oldest lastByeRound.
 *   3. Tie-break on lastByeRound: pair.id ASC.
 *
 * Pure function — no side effects, no DB access. The caller persists the
 * output to org_tournament_matches.
 */
export function generateSwissPairings(input: SwissPairingInput): RoundPairingResult {
  const { pairs, previousMatches, roundNumber, targetPoints } = input;
  const warnings: string[] = [];

  const activePairs = pairs.filter((p) => p.withdrawnAt === null);

  let byePairId: string | null = null;
  let pairsForMatching = activePairs;

  // Order active pairs best → worst (for both bye selection and main pairing).
  let bestToWorst: Pair[];
  let standingMap: Map<string, PairStanding>;

  if (roundNumber === 1) {
    bestToWorst = sortByInitialSeed(activePairs);
    standingMap = new Map();
  } else {
    const standings = computeStandings(pairs, previousMatches, targetPoints);
    standingMap = new Map(standings.map((s) => [s.pairId, s]));
    bestToWorst = [...activePairs].sort((a, b) => {
      const sa = standingMap.get(a.id);
      const sb = standingMap.get(b.id);
      if (!sa || !sb) return a.id < b.id ? -1 : 1;
      return compareStandings(sa, sb);
    });
  }

  if (activePairs.length % 2 === 1) {
    // Primary: lowest-ranked without a prior bye.
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

    // Fallback (strict rotation): oldest lastByeRound wins, tie-break by id ASC.
    if (byeCandidate === null) {
      const byOldestBye = [...bestToWorst].sort((a, b) => {
        const la = standingMap.get(a.id)?.lastByeRound ?? Number.MIN_SAFE_INTEGER;
        const lb = standingMap.get(b.id)?.lastByeRound ?? Number.MIN_SAFE_INTEGER;
        if (la !== lb) return la - lb;
        return a.id < b.id ? -1 : 1;
      });
      byeCandidate = byOldestBye[0];
    }

    byePairId = byeCandidate.id;
    pairsForMatching = activePairs.filter((p) => p.id !== byePairId);
  }

  // Order pairs-for-matching using the same logic as bestToWorst, but only
  // over the subset (bye removed).
  const orderedIds: string[] =
    roundNumber === 1
      ? sortByInitialSeed(pairsForMatching).map((p) => p.id)
      : [...pairsForMatching]
          .sort((a, b) => {
            const sa = standingMap.get(a.id);
            const sb = standingMap.get(b.id);
            if (!sa || !sb) return a.id < b.id ? -1 : 1;
            return compareStandings(sa, sb);
          })
          .map((p) => p.id);

  const playedSet = buildPlayedSet(previousMatches);
  const { pairings: rawPairings, warnings: pairingWarnings } = greedyPair(orderedIds, playedSet);
  warnings.push(...pairingWarnings);

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
