import { describe, test, expect } from 'vitest';
import { generateSwissPairings } from './generate-pairings';
import type { Pair, Match, SwissPairingInput } from './swiss-types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makePair(id: string, initialSeed: number | null = null, withdrawnAt: string | null = null): Pair {
  return { id, initialSeed, withdrawnAt };
}

function makeFinishedMatch(
  id: string,
  pairHomeId: string,
  pairAwayId: string,
  homeScore: number,
  awayScore: number,
): Match {
  return {
    id,
    pairHomeId,
    pairAwayId,
    pairHomeScore: homeScore,
    pairAwayScore: awayScore,
    status: 'finished',
  };
}

function makeByeMatch(id: string, pairHomeId: string): Match {
  return {
    id,
    pairHomeId,
    pairAwayId: null,
    pairHomeScore: null,
    pairAwayScore: null,
    status: 'bye',
  };
}

// Build a default input for round 1 with N seeded pairs.
function makeRound1Input(n: number): SwissPairingInput {
  const pairs = Array.from({ length: n }, (_, i) =>
    makePair(`pair-${String(i + 1).padStart(2, '0')}`, i + 1),
  );
  return { pairs, previousMatches: [], roundNumber: 1, tiebreaker: 'margin_of_victory' };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateSwissPairings — Round 1 seeding', () => {
  test('Test 1 (spec): 16 pairs by initial seed → 1v2, 3v4, …, 15v16', () => {
    const input = makeRound1Input(16);
    const result = generateSwissPairings(input);

    expect(result.byePairId).toBeNull();
    expect(result.pairings).toHaveLength(8);
    expect(result.warnings).toHaveLength(0);

    for (let t = 0; t < 8; t++) {
      const pairing = result.pairings[t];
      expect(pairing.tableNumber).toBe(t + 1);
      // Seed pairs: [1,2], [3,4], … → index 2t and 2t+1 seeds
      const expectedHomeSeed = 2 * t + 1;
      const expectedAwaySeed = 2 * t + 2;
      const homeId = `pair-${String(expectedHomeSeed).padStart(2, '0')}`;
      const awayId = `pair-${String(expectedAwaySeed).padStart(2, '0')}`;
      expect(pairing.pairHomeId).toBe(homeId);
      expect(pairing.pairAwayId).toBe(awayId);
    }
  });

  test('Round 1 with null seeds falls back to pair.id sort for determinism', () => {
    const pairs = [
      makePair('bbb', null),
      makePair('aaa', null),
      makePair('ddd', null),
      makePair('ccc', null),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches: [],
      roundNumber: 1,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    // Sorted by id ASC: aaa, bbb, ccc, ddd → aaa vs bbb, ccc vs ddd
    expect(result.pairings[0].pairHomeId).toBe('aaa');
    expect(result.pairings[0].pairAwayId).toBe('bbb');
    expect(result.pairings[1].pairHomeId).toBe('ccc');
    expect(result.pairings[1].pairAwayId).toBe('ddd');
  });
});

describe('generateSwissPairings — Round 2+ standings sort', () => {
  test('Test 2 (spec): leaders play leaders, losers play losers after round 1', () => {
    // 4 pairs, 2 tables in round 1
    // p1 beat p2 (winner), p3 beat p4 (winner)
    // Round 2: p1 vs p3 (winners), p2 vs p4 (losers)
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 50),
      makeFinishedMatch('m2', 'p3', 'p4', 100, 50),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    expect(result.byePairId).toBeNull();
    expect(result.pairings).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    // Both p1 and p3 have 3 pts; p1 id < p3 id so p1 is home
    const table1 = result.pairings[0];
    const table2 = result.pairings[1];

    const winners = new Set(['p1', 'p3']);
    const losers = new Set(['p2', 'p4']);

    // Both players at table 1 should be winners
    expect(winners.has(table1.pairHomeId)).toBe(true);
    expect(winners.has(table1.pairAwayId)).toBe(true);
    // Both players at table 2 should be losers
    expect(losers.has(table2.pairHomeId)).toBe(true);
    expect(losers.has(table2.pairAwayId)).toBe(true);
  });

  test('Test 7 (spec): tiebreaker margin_of_victory — 6pts/+10 ranks above 6pts/+5', () => {
    // p1 won by +10, p2 won by +5 both round 1. Round 2 pairing: p1 is top seed.
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p3', 110, 100), // p1 3pts +10
      makeFinishedMatch('m2', 'p2', 'p4', 105, 100), // p2 3pts +5
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    // p1 (3pts, +10) should play p2 (3pts, +5) — both winners
    const table1 = result.pairings[0];
    expect(new Set([table1.pairHomeId, table1.pairAwayId])).toEqual(new Set(['p1', 'p2']));
    // p1 as higher-ranked should be home
    expect(table1.pairHomeId).toBe('p1');
  });
});

describe('generateSwissPairings — rematch avoidance', () => {
  test('Test 3 (spec): avoids rematches when possible', () => {
    // p1 played p2 in round 1. In round 2, p1 should play p3 or p4, not p2.
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 50),
      makeFinishedMatch('m2', 'p3', 'p4', 100, 50),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    const allPairedOpponents = result.pairings.map((p) => [p.pairHomeId, p.pairAwayId]);

    // p1 vs p2 should NOT appear again
    const hasRematch = allPairedOpponents.some(
      ([h, a]) =>
        (h === 'p1' && a === 'p2') ||
        (h === 'p2' && a === 'p1'),
    );
    expect(hasRematch).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test('Test 9 (spec): 2 pairs, round 2 forces rematch with warning', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2)];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 80),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    expect(result.pairings).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/fallback used/);
  });

  test('Test 9b (spec): 2 pairs over 3 rounds — round 1 ok, round 2 rematch warned, round 3 rematch warned', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2)];

    // Round 1 — no previous matches
    const r1 = generateSwissPairings({
      pairs,
      previousMatches: [],
      roundNumber: 1,
      tiebreaker: 'margin_of_victory',
    });
    expect(r1.pairings).toHaveLength(1);
    expect(r1.warnings).toHaveLength(0);

    const r1Matches: Match[] = [makeFinishedMatch('m1', 'p1', 'p2', 100, 80)];

    // Round 2 — forced rematch
    const r2 = generateSwissPairings({
      pairs,
      previousMatches: r1Matches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    });
    expect(r2.pairings).toHaveLength(1);
    expect(r2.warnings.length).toBeGreaterThan(0);

    const r2Matches: Match[] = [
      ...r1Matches,
      makeFinishedMatch('m2', 'p1', 'p2', 100, 90),
    ];

    // Round 3 — still forced rematch
    const r3 = generateSwissPairings({
      pairs,
      previousMatches: r2Matches,
      roundNumber: 3,
      tiebreaker: 'margin_of_victory',
    });
    expect(r3.pairings).toHaveLength(1);
    expect(r3.warnings.length).toBeGreaterThan(0);
  });
});

describe('generateSwissPairings — bye handling', () => {
  test('Test 4 (spec): odd number → bye to lowest-ranked pair without prior bye', () => {
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches: [],
      roundNumber: 1,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    expect(result.byePairId).not.toBeNull();
    // Lowest seed = p3 (seed 3) gets the bye in round 1
    expect(result.byePairId).toBe('p3');
    expect(result.pairings).toHaveLength(1);
    expect(result.pairings[0].pairHomeId).toBe('p1');
    expect(result.pairings[0].pairAwayId).toBe('p2');
  });

  test('Test 5 (spec): bye does not repeat for same pair if avoidable', () => {
    // p3 got a bye in round 1. In round 2 (still 3 pairs), bye goes to p2 (next lowest).
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 80),
      makeByeMatch('bye1', 'p3'),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    // p3 already had a bye; bye should go to p2 (0 pts, lower than p1)
    expect(result.byePairId).not.toBe('p3');
    expect(result.byePairId).toBe('p2');
  });

  test('bye falls back to lowest-ranked when all active pairs have had byes', () => {
    // 3 pairs, all have had a bye (contrived scenario)
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
    ];
    const previousMatches: Match[] = [
      makeByeMatch('bye1', 'p1'),
      makeByeMatch('bye2', 'p2'),
      makeByeMatch('bye3', 'p3'),
      // Also need real matches to have occurred; we fake round histories
      makeFinishedMatch('m1', 'p1', 'p2', 100, 90),
      makeFinishedMatch('m2', 'p1', 'p3', 100, 85),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 4,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    // All have had byes — bye goes to lowest ranked (p2 or p3; both 0pts from real matches)
    // p1: 6pts+bye, p2: 0pts+bye(3), p3: 0pts+bye(3) — after standings p2 tie p3
    expect(result.byePairId).not.toBeNull();
  });
});

describe('generateSwissPairings — withdrawn pairs', () => {
  test('withdrawn pair excluded from pairings', () => {
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3, '2025-01-01T00:00:00Z'), // withdrawn
      makePair('p4', 4),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches: [],
      roundNumber: 1,
      tiebreaker: 'margin_of_victory',
    };
    const result = generateSwissPairings(input);
    const allIds = result.pairings.flatMap((p) => [p.pairHomeId, p.pairAwayId]);
    expect(allIds).not.toContain('p3');
  });
});

describe('generateSwissPairings — determinism', () => {
  test('Test 8 (spec): 10 identical calls produce identical output', () => {
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
      makePair('p5', 5),
      makePair('p6', 6),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 80),
      makeFinishedMatch('m2', 'p3', 'p4', 100, 70),
      makeFinishedMatch('m3', 'p5', 'p6', 100, 60),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'margin_of_victory',
    };

    const first = generateSwissPairings(input);
    for (let i = 0; i < 9; i++) {
      const result = generateSwissPairings(input);
      expect(result.byePairId).toBe(first.byePairId);
      expect(result.warnings).toEqual(first.warnings);
      expect(result.pairings.length).toBe(first.pairings.length);
      for (let t = 0; t < first.pairings.length; t++) {
        expect(result.pairings[t]).toEqual(first.pairings[t]);
      }
    }
  });
});

describe('generateSwissPairings — tiebreaker buchholz', () => {
  test('Test 10 (spec): buchholz differentiates when points and MoV tie', () => {
    // Setup: 6 pairs. In round 1:
    //   p1 beats opp1 (+10), p2 beats opp2 (+10), opp1 beats opp3 (opp1 gets 6pts total)
    // After round 1+bonus:
    //   p1: 3pts, margin=+10, buchholz = opp1.points = 3
    //   p2: 3pts, margin=+10, buchholz = opp2.points = 0
    //   opp1: 3pts, margin=+10+50, opp2: 0pts, opp3: 0pts
    // With buchholz tiebreaker: p1 (buch=3) > p2 (buch=0).
    // Round 2 table 1 should pair p1 vs opp1 (the two with highest standings by buchholz).
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('opp1', 3),
      makePair('opp2', 4),
    ];
    // Round 1 results: p1 beats opp1, p2 beats opp2
    // Additionally opp1 previously (in an earlier round) beat opp2 to accumulate points.
    // We simulate this by adding an extra finished match.
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'opp1', 110, 100), // p1: 3pts +10, opp1: 0pts
      makeFinishedMatch('m2', 'p2', 'opp2', 110, 100), // p2: 3pts +10, opp2: 0pts
      // opp1 also played a third pair and won — gives opp1 more total points
      // We add a third pair for this purpose
    ];
    // Without a 3rd pair match, both p1.buchholz = opp1.points = 0, p2.buchholz = opp2.points = 0
    // We need opp1 to have nonzero points when p1 played it.
    // Solution: opp1 should have won a match in an earlier round (round 0 doesn't exist,
    // so we add another pair and a prior match).
    //
    // Revised fixture with 6 pairs: p1, p2, opp1, opp2, extra1, extra2
    // Round 0 (earlier): opp1 beats extra1 → opp1=3pts before playing p1
    // Round 1: p1 beats opp1, p2 beats opp2, extra1 beats extra2
    // Standings entering round 2:
    //   opp1: 3pts (r0 win), p1: 3pts (r1 win), p2: 3pts (r1 win)
    //   p1.buchholz = opp1.pts = 3; p2.buchholz = opp2.pts = 0
    // So p1 (3pts, buch=3) ranks above p2 (3pts, buch=0)
    const pairs6 = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('opp1', 3),
      makePair('opp2', 4),
      makePair('extra1', 5),
      makePair('extra2', 6),
    ];
    const matches6: Match[] = [
      makeFinishedMatch('r0m1', 'opp1', 'extra1', 100, 50),  // opp1 wins round 0
      makeFinishedMatch('r1m1', 'p1', 'opp1', 110, 100),     // p1 wins round 1 vs opp1 (+10)
      makeFinishedMatch('r1m2', 'p2', 'opp2', 110, 100),     // p2 wins round 1 vs opp2 (+10)
      makeFinishedMatch('r1m3', 'extra1', 'extra2', 100, 80), // extra1 wins
    ];
    // Standings after these matches:
    //   opp1: 3pts (r0) + 0pts (r1 loss) = 3pts total
    //   p1: 3pts; p1.buchholz = opp1.pts = 3
    //   p2: 3pts; p2.buchholz = opp2.pts = 0
    //   extra1: 3pts (r0 loss) = 0pts + 3pts (r1 win) = 3pts
    //   opp2: 0pts; extra2: 0pts
    // Sort by buchholz DESC (among tied 3pt pairs):
    //   p1 (buch=3) > extra1 (buch=?) > opp1 (buch=?) > p2 (buch=0)
    //   extra1.buchholz = extra2.pts = 0 (extra2 lost both)
    //   Wait — extra1 played opp1(r0,won) and extra2(r1,won).
    //   extra1.buchholz = opp1.pts(3) + extra2.pts(0) = 3
    //   opp1.buchholz = extra1.pts(3) + p1.pts(3) = 6
    // So 3pt pairs by buchholz: opp1(buch=6) > extra1(buch=3) = p1(buch=3) > p2(buch=0)
    // extra1 vs p1 tie on buchholz(3), use margin: extra1=+20+20=+40? No:
    //   extra1 margin: (r0: lost -50) + (r1: won +20) = -30
    //   p1 margin: won +10
    // So p1(buch=3,margin=+10) > extra1(buch=3,margin=-30)
    // Final sort: opp1(3pts,buch=6), p1(3pts,buch=3,margin=+10), extra1(3pts,buch=3,margin=-30), p2(3pts,buch=0), ..
    // Round 2 pairings (all played: opp1-extra1, p1-opp1, p2-opp2, extra1-extra2):
    //   opp1 (1st) looks for partner: p1 (2nd) — have they played? YES (r1m1). Skip.
    //   opp1 tries extra1 (3rd): played? YES (r0m1). Skip.
    //   opp1 tries p2 (4th): played? NO → opp1 vs p2. ✓
    //   p1 (2nd) is next: looks for extra1 (3rd, not used): played? NO → p1 vs extra1. ✓
    //   opp2 vs extra2 remaining.
    const input6: SwissPairingInput = {
      pairs: pairs6,
      previousMatches: matches6,
      roundNumber: 2,
      tiebreaker: 'buchholz',
    };
    const result = generateSwissPairings(input6);
    // Verify p1 and p2 are NOT at the same table (different buchholz → separated by standings).
    // Even though greedy pairing may put p2 at table 1 (paired with opp1 which cannot rematch p1),
    // the key invariant is: p1 (buch=3) and p2 (buch=0) are kept apart.
    for (const pairing of result.pairings) {
      const ids = new Set([pairing.pairHomeId, pairing.pairAwayId]);
      expect(ids.has('p1') && ids.has('p2')).toBe(false);
    }
    // opp1 has the highest buchholz among 3pt pairs → opp1 is at table 1.
    // opp1 cannot rematch p1 or extra1 → opp1 is paired with p2 (next available with no prior match).
    const table1 = result.pairings[0];
    expect(new Set([table1.pairHomeId, table1.pairAwayId])).toEqual(new Set(['opp1', 'p2']));
    // p1 (rank2, buch=3) pairs with extra1 (rank3) at table 2.
    const table2 = result.pairings[1];
    expect(new Set([table2.pairHomeId, table2.pairAwayId])).toEqual(new Set(['p1', 'extra1']));
  });
});

describe('generateSwissPairings — tiebreaker head_to_head', () => {
  test('Test 11 (spec): head-to-head win determines ranking when points tie', () => {
    // 4 pairs. Round 1: p1 beats p3 (h2h win for p1 over p3). p2 beats p4.
    // Round 2 standings: p1=3pts (h2h beat p3), p2=3pts, p3=0pts, p4=0pts.
    // p1 vs p2: no direct h2h → fall back to margin (both +10) → pair.id (p1 < p2).
    // Sorted: p1(rank1), p2(rank2), p3(rank3), p4(rank4).
    // Greedy round 2: p1 tries p2 (not played yet) → p1 vs p2.
    // Then p3 vs p4 (not played yet — p3 played p1, p4 played p2).
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
    ];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p3', 100, 90),  // p1 beats p3 h2h, +10
      makeFinishedMatch('m2', 'p2', 'p4', 100, 90),  // p2 beats p4, +10
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'head_to_head',
    };
    const result = generateSwissPairings(input);
    expect(result.pairings).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    const table1 = result.pairings[0];
    // p1 and p2 (both 3pts, no h2h between them, equal margin → p1 ranks above p2 by id)
    expect(new Set([table1.pairHomeId, table1.pairAwayId])).toEqual(new Set(['p1', 'p2']));
    expect(table1.pairHomeId).toBe('p1');
  });

  test('head_to_head direct win promotes correct pair and affects bye selection', () => {
    // 3 active pairs. p1 beat p2 (h2h). p3 is new with 0pts.
    // Standings (h2h tiebreaker):
    //   p1: 3pts, margin=+20. p2: 0pts, margin=-20. p3: 0pts, margin=0.
    //   p2 vs p3: no h2h match → fall back to margin: p3(0) > p2(-20) → p3 ranks above p2.
    //   Sorted best→worst: [p1, p3, p2]. Worst without prior bye = p2 → bye goes to p2.
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3)];
    const previousMatches: Match[] = [
      makeFinishedMatch('m1', 'p1', 'p2', 100, 80), // p1 wins h2h (+20 for p1, -20 for p2)
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      tiebreaker: 'head_to_head',
    };
    const result = generateSwissPairings(input);
    // p2 is the worst-ranked (0pts, margin=-20 < p3's margin=0) → gets the bye
    expect(result.byePairId).toBe('p2');
    // p1 plays p3 (the only remaining pair)
    expect(result.pairings).toHaveLength(1);
    // p1 is home (ranked 1st with 3pts)
    expect(result.pairings[0].pairHomeId).toBe('p1');
    expect(result.pairings[0].pairAwayId).toBe('p3');
  });
});
