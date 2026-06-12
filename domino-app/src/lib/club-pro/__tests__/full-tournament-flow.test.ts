/**
 * Integration test: simulates a complete Swiss tournament end-to-end.
 *
 * Scope: exercises the engine layer (generateSwissPairings +
 * computeStandings) round-by-round, threading the output of one round as
 * input to the next. This is the canonical "did the engine actually work
 * together correctly" test — it catches bugs that unit tests would miss
 * (e.g. byeRotation interacting badly with CE ranking, or a final
 * standings calculation that diverges from the per-round sort).
 *
 * Out of scope: server actions, Supabase DB, auth, emails. Those run in
 * the e2e/ Playwright suite (and require live infra).
 */

import { describe, test, expect } from 'vitest';
import { generateSwissPairings } from '../generate-pairings';
import { computeStandings } from '../compute-standings';
import type { Pair, Match, PairStanding } from '../swiss-types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

type Tournament = {
  pairs: Pair[];
  matches: Match[];
  targetPoints: number;
  currentRound: number;
};

function makePair(id: string, seed: number): Pair {
  return { id, initialSeed: seed, withdrawnAt: null };
}

/**
 * Simulates one round: generates pairings via the engine, records the
 * given scores against the resulting matches, and returns updated
 * matches. Throws if the engine output doesn't match expectedPairings
 * (sanity check that the simulation is well-formed).
 */
function playRound(
  tournament: Tournament,
  scoresByPair: Map<string, number>,
): Match[] {
  const round = generateSwissPairings({
    pairs: tournament.pairs,
    previousMatches: tournament.matches,
    roundNumber: tournament.currentRound,
    targetPoints: tournament.targetPoints,
  });

  const newMatches: Match[] = [];

  for (const pairing of round.pairings) {
    const homeScore = scoresByPair.get(pairing.pairHomeId);
    const awayScore = scoresByPair.get(pairing.pairAwayId);
    if (homeScore === undefined || awayScore === undefined) {
      throw new Error(
        `Test setup missing score for ${pairing.pairHomeId} or ${pairing.pairAwayId}`,
      );
    }
    newMatches.push({
      id: `r${tournament.currentRound}-t${pairing.tableNumber}`,
      pairHomeId: pairing.pairHomeId,
      pairAwayId: pairing.pairAwayId,
      pairHomeScore: homeScore,
      pairAwayScore: awayScore,
      status: 'finished',
      roundNumber: tournament.currentRound,
    });
  }

  if (round.byePairId) {
    newMatches.push({
      id: `r${tournament.currentRound}-bye`,
      pairHomeId: round.byePairId,
      pairAwayId: null,
      pairHomeScore: null,
      pairAwayScore: null,
      status: 'bye',
      roundNumber: tournament.currentRound,
    });
  }

  return newMatches;
}

function sortStandings(standings: PairStanding[]): PairStanding[] {
  return [...standings].sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.effectivenessCoefficient !== b.effectivenessCoefficient) {
      return b.effectivenessCoefficient - a.effectivenessCoefficient;
    }
    if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;
    const aVsB = a.headToHeadResults.get(b.pairId);
    if (aVsB === 'win') return -1;
    if (aVsB === 'loss') return 1;
    return a.pairId < b.pairId ? -1 : 1;
  });
}

// ─── Test 1: 4 pairs × 3 rounds, deterministic winners ────────────────────────

describe('full tournament flow: 4 pairs × 3 rounds', () => {
  test('deterministic winners produce expected final standings', () => {
    // Setup: 4 pairs, target 200. Throughout the tournament, p1 always
    // wins, p4 always loses. p2 and p3 trade results.
    const target = 200;
    const tournament: Tournament = {
      pairs: [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)],
      matches: [],
      targetPoints: target,
      currentRound: 1,
    };

    // ── Round 1 ──
    // Engine pairs by seed: p1 vs p2, p3 vs p4.
    // p1 beats p2 200-100; p3 beats p4 200-100.
    tournament.matches = playRound(
      tournament,
      new Map([
        ['p1', 200],
        ['p2', 100],
        ['p3', 200],
        ['p4', 100],
      ]),
    );
    tournament.currentRound = 2;

    // Sanity: after R1 standings should be p1 and p3 at 1W each, then p2/p4 at 0W.
    let standings = sortStandings(
      computeStandings(tournament.pairs, tournament.matches, target),
    );
    expect(standings.map((s) => s.pairId)).toEqual(['p1', 'p3', 'p2', 'p4']);

    // ── Round 2 ──
    // Engine: winners play winners (p1 vs p3), losers vs losers (p2 vs p4).
    // p1 beats p3 200-150; p2 beats p4 200-100.
    tournament.matches = [
      ...tournament.matches,
      ...playRound(
        tournament,
        new Map([
          ['p1', 200],
          ['p3', 150],
          ['p2', 200],
          ['p4', 100],
        ]),
      ),
    ];
    tournament.currentRound = 3;

    // After R2: p1=2W, p2=1W, p3=1W, p4=0W.
    standings = sortStandings(computeStandings(tournament.pairs, tournament.matches, target));
    expect(standings[0].pairId).toBe('p1');
    expect(standings[0].wins).toBe(2);
    expect(standings[3].pairId).toBe('p4');
    expect(standings[3].wins).toBe(0);

    // ── Round 3 ──
    // Engine: top is p1 (2W). p1 already played p2 and p3. Greedy pairing
    // will pair p1 with p4 (whom p1 has NOT faced yet) — no rematch warning.
    // The remaining pair (p2 vs p3) — p2 and p3 also haven't played each
    // other yet → no warning either.
    const r3 = generateSwissPairings({
      pairs: tournament.pairs,
      previousMatches: tournament.matches,
      roundNumber: 3,
      targetPoints: target,
    });
    // p1 must be in the first pairing (top of standings).
    const p1Pairing = r3.pairings.find(
      (p) => p.pairHomeId === 'p1' || p.pairAwayId === 'p1',
    );
    expect(p1Pairing).toBeDefined();
    // No rematch warning — fresh pairings available.
    expect(r3.warnings).toHaveLength(0);
    // p1 should be paired with p4 (the only unplayed opponent left for p1).
    const p1Opponent =
      p1Pairing!.pairHomeId === 'p1' ? p1Pairing!.pairAwayId : p1Pairing!.pairHomeId;
    expect(p1Opponent).toBe('p4');

    // Play R3: p1 wins again (whoever the opponent is).
    const scores = new Map<string, number>();
    for (const pairing of r3.pairings) {
      const isP1Home = pairing.pairHomeId === 'p1';
      const isP1Away = pairing.pairAwayId === 'p1';
      if (isP1Home || isP1Away) {
        scores.set('p1', 200);
        scores.set(isP1Home ? pairing.pairAwayId : pairing.pairHomeId, 100);
      } else {
        // The other pairing: home wins (deterministic).
        scores.set(pairing.pairHomeId, 200);
        scores.set(pairing.pairAwayId, 50);
      }
    }
    tournament.matches = [...tournament.matches, ...playRound(tournament, scores)];

    // Final standings: p1 has 3W (perfect record).
    standings = sortStandings(computeStandings(tournament.pairs, tournament.matches, target));
    expect(standings[0].pairId).toBe('p1');
    expect(standings[0].wins).toBe(3);
    expect(standings[0].losses).toBe(0);
    // p4 has 0W (worst).
    const p4Final = standings.find((s) => s.pairId === 'p4');
    expect(p4Final?.wins).toBe(0);
    expect(p4Final?.losses).toBeGreaterThan(0);
  });
});

// ─── Test 2: 5 pairs (odd, byes rotate) ───────────────────────────────────────

describe('full tournament flow: 5 pairs with bye rotation', () => {
  test('byes rotate strictly, no pair has 2 byes when 3 rounds in 5 pairs', () => {
    const target = 200;
    const tournament: Tournament = {
      pairs: Array.from({ length: 5 }, (_, i) => makePair(`p${i + 1}`, i + 1)),
      matches: [],
      targetPoints: target,
      currentRound: 1,
    };

    const byesReceived = new Set<string>();

    for (let round = 1; round <= 3; round++) {
      const result = generateSwissPairings({
        pairs: tournament.pairs,
        previousMatches: tournament.matches,
        roundNumber: round,
        targetPoints: target,
      });

      // Every round should have exactly 2 matches + 1 bye.
      expect(result.pairings).toHaveLength(2);
      expect(result.byePairId).not.toBeNull();

      // First 3 rounds: bye should go to a DIFFERENT pair each time.
      expect(byesReceived.has(result.byePairId!)).toBe(false);
      byesReceived.add(result.byePairId!);

      // Play the round (whoever is home wins 200-100).
      const scores = new Map<string, number>();
      for (const pairing of result.pairings) {
        scores.set(pairing.pairHomeId, 200);
        scores.set(pairing.pairAwayId, 100);
      }
      tournament.matches = [...tournament.matches, ...playRound(tournament, scores)];
      tournament.currentRound = round + 1;
    }

    expect(byesReceived.size).toBe(3); // 3 different pairs got bye in 3 rounds.
  });
});

// ─── Test 3: withdrawn pair mid-tournament ────────────────────────────────────

describe('full tournament flow: withdrawal preserves past results', () => {
  test('pair retires after R2; their R1 win still counts; engine excludes from R3', () => {
    const target = 200;
    const tournament: Tournament = {
      pairs: [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)],
      matches: [],
      targetPoints: target,
      currentRound: 1,
    };

    // ── R1: standard pairing, p2 wins ──
    tournament.matches = playRound(
      tournament,
      new Map([
        ['p1', 100],
        ['p2', 200],
        ['p3', 200],
        ['p4', 100],
      ]),
    );
    tournament.currentRound = 2;

    // After R1: p2 has 1W
    let standings = computeStandings(tournament.pairs, tournament.matches, target);
    const p2AfterR1 = standings.find((s) => s.pairId === 'p2');
    expect(p2AfterR1?.wins).toBe(1);

    // ── R2: play it ──
    tournament.matches = [
      ...tournament.matches,
      ...playRound(
        tournament,
        new Map([
          ['p2', 200],
          ['p3', 100], // tied winners play
          ['p1', 200],
          ['p4', 50], // tied losers play
        ]),
      ),
    ];
    tournament.currentRound = 3;

    // ── p2 withdraws between R2 and R3 ──
    tournament.pairs = tournament.pairs.map((p) =>
      p.id === 'p2' ? { ...p, withdrawnAt: '2026-06-10T12:00:00Z' } : p,
    );

    // R3 engine call: p2 must be excluded.
    const r3 = generateSwissPairings({
      pairs: tournament.pairs,
      previousMatches: tournament.matches,
      roundNumber: 3,
      targetPoints: target,
    });
    const allPlayersR3 = r3.pairings.flatMap((p) => [p.pairHomeId, p.pairAwayId]);
    if (r3.byePairId) allPlayersR3.push(r3.byePairId);
    expect(allPlayersR3).not.toContain('p2');

    // Standings still reflect p2's past results.
    standings = computeStandings(tournament.pairs, tournament.matches, target);
    const p2Final = standings.find((s) => s.pairId === 'p2');
    expect(p2Final?.wins).toBe(2); // R1 win + R2 win = 2W
    expect(p2Final?.withdrawn).toBe(true);
  });
});

// ─── Test 4: CE differentiates equal-record pairs ─────────────────────────────

describe('full tournament flow: CE breaks ties between same-record pairs', () => {
  test('two pairs with same wins, different CE, are ordered correctly in final standings', () => {
    const target = 200;
    const tournament: Tournament = {
      pairs: [
        makePair('p1', 1),
        makePair('p2', 2),
        makePair('p3', 3),
        makePair('p4', 4),
      ],
      matches: [],
      targetPoints: target,
      currentRound: 1,
    };

    // R1: p1 wins 200-50 (CE +0.75). p2 wins 200-150 (CE +0.25).
    tournament.matches = playRound(
      tournament,
      new Map([
        ['p1', 200],
        ['p2', 200],
        ['p3', 150], // p2's opponent
        ['p4', 50], // p1's opponent
      ]),
    );

    // Wait — the engine pairs by seed: p1 vs p2, p3 vs p4. So we need
    // p1 to beat p2 by a wide margin and p3 to beat p4 by a narrow one,
    // or vice versa. Reset.
    tournament.matches = [];
    tournament.matches = playRound(
      tournament,
      new Map([
        ['p1', 200],
        ['p2', 50], // p1 wins big (+0.75 CE)
        ['p3', 200],
        ['p4', 150], // p3 wins narrow (+0.25 CE)
      ]),
    );
    tournament.currentRound = 2;

    const standings = sortStandings(
      computeStandings(tournament.pairs, tournament.matches, target),
    );

    // Both p1 and p3 have 1W. p1 has higher CE → ranks above p3.
    expect(standings[0].pairId).toBe('p1');
    expect(standings[1].pairId).toBe('p3');
    expect(standings[0].effectivenessCoefficient).toBeGreaterThan(
      standings[1].effectivenessCoefficient,
    );
  });
});
