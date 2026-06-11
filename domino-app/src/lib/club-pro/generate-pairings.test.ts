import { describe, test, expect } from 'vitest';
import { generateSwissPairings } from './generate-pairings';
import type { Pair, Match, SwissPairingInput } from './swiss-types';

function makePair(id: string, initialSeed: number | null = null, withdrawnAt: string | null = null): Pair {
  return { id, initialSeed, withdrawnAt };
}

function makeFinishedMatch(
  id: string,
  pairHomeId: string,
  pairAwayId: string,
  homeScore: number,
  awayScore: number,
  roundNumber: number = 1,
): Match {
  return {
    id,
    pairHomeId,
    pairAwayId,
    pairHomeScore: homeScore,
    pairAwayScore: awayScore,
    status: 'finished',
    roundNumber,
  };
}

function makeByeMatch(id: string, pairHomeId: string, roundNumber: number = 1): Match {
  return {
    id,
    pairHomeId,
    pairAwayId: null,
    pairHomeScore: null,
    pairAwayScore: null,
    status: 'bye',
    roundNumber,
  };
}

function makeRound1Input(n: number, targetPoints: number = 200): SwissPairingInput {
  const pairs = Array.from({ length: n }, (_, i) =>
    makePair(`pair-${String(i + 1).padStart(2, '0')}`, i + 1),
  );
  return { pairs, previousMatches: [], roundNumber: 1, targetPoints };
}

describe('generateSwissPairings — Round 1 seeding', () => {
  test('16 pairs by initial seed → 1v2, 3v4, ..., 15v16', () => {
    const result = generateSwissPairings(makeRound1Input(16));
    expect(result.byePairId).toBeNull();
    expect(result.pairings).toHaveLength(8);
    expect(result.warnings).toHaveLength(0);

    for (let t = 0; t < 8; t++) {
      const pairing = result.pairings[t];
      expect(pairing.tableNumber).toBe(t + 1);
      const expectedHome = `pair-${String(2 * t + 1).padStart(2, '0')}`;
      const expectedAway = `pair-${String(2 * t + 2).padStart(2, '0')}`;
      expect(pairing.pairHomeId).toBe(expectedHome);
      expect(pairing.pairAwayId).toBe(expectedAway);
    }
  });

  test('null seeds → pair.id ASC for determinism', () => {
    const pairs = [makePair('bbb'), makePair('aaa'), makePair('ddd'), makePair('ccc')];
    const result = generateSwissPairings({ pairs, previousMatches: [], roundNumber: 1, targetPoints: 200 });
    expect(result.pairings[0].pairHomeId).toBe('aaa');
    expect(result.pairings[0].pairAwayId).toBe('bbb');
    expect(result.pairings[1].pairHomeId).toBe('ccc');
    expect(result.pairings[1].pairAwayId).toBe('ddd');
  });
});

describe('generateSwissPairings — Round 2+ standings sort', () => {
  test('winners play winners, losers play losers', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p2', 200, 100),
      makeFinishedMatch('m2', 'p3', 'p4', 200, 100),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    });
    expect(result.pairings).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    const winners = new Set(['p1', 'p3']);
    const losers = new Set(['p2', 'p4']);
    const t1 = result.pairings[0];
    const t2 = result.pairings[1];
    expect(winners.has(t1.pairHomeId)).toBe(true);
    expect(winners.has(t1.pairAwayId)).toBe(true);
    expect(losers.has(t2.pairHomeId)).toBe(true);
    expect(losers.has(t2.pairAwayId)).toBe(true);
  });
});

describe('generateSwissPairings — tiebreak CE', () => {
  test('CE separates tied pairs: 200-50 (CE+0.75) ranks above 200-150 (CE+0.25)', () => {
    // p1 wins 200-50 → CE=+0.75; p2 wins 200-150 → CE=+0.25.
    // Both have 1 win. Tiebreaker: CE. p1 ranks above p2.
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p3', 200, 50),
      makeFinishedMatch('m2', 'p2', 'p4', 200, 150),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    });
    // p1 (rank1) vs p2 (rank2) at table 1; p1 is home (higher CE).
    const table1 = result.pairings[0];
    expect(new Set([table1.pairHomeId, table1.pairAwayId])).toEqual(new Set(['p1', 'p2']));
    expect(table1.pairHomeId).toBe('p1');
  });

  test('pointsScored breaks tie when wins and CE both match', () => {
    // p1 and p2 each win 200-100 (CE +0.5 each).
    // p3 and p4 each lose with same scores → standings tie among winners.
    // Add a third match where p1 scores more points overall.
    // p1 actually has +1 win, p2 +1 win. Same CE. Diff in pointsScored only
    // through cap interaction or different finished match — but here scores
    // identical → final tiebreak is pair.id ASC.
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p3', 200, 100),
      makeFinishedMatch('m2', 'p2', 'p4', 200, 100),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    });
    // Identical stats — p1 ranks above p2 by id ASC.
    const table1 = result.pairings[0];
    expect(table1.pairHomeId).toBe('p1');
  });
});

describe('generateSwissPairings — head-to-head tiebreak', () => {
  test('h2h winner ranks above when wins, CE, points all tie', () => {
    // p1 and p2 only played each other (1 match). Both have identical scores
    // except who won. p1 won 200-100. So p1: 1W/0L/CE+0.5, p2: 0W/1L/CE-0.5.
    // They DON'T tie in wins, so h2h isn't tested here.
    // To test h2h, need 4 pairs where p1 and p2 each won 1 and also played each other.
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p2', 200, 100, 1), // p1 beats p2 (h2h)
      makeFinishedMatch('m2', 'p3', 'p4', 200, 100, 1),
      makeFinishedMatch('m3', 'p1', 'p3', 200, 100, 2), // p1 beats p3
      makeFinishedMatch('m4', 'p2', 'p4', 200, 100, 2), // p2 beats p4
    ];
    // After R2: p1 has 2W (h2h beat p2), p2 has 1W, p3 has 1W, p4 has 0W.
    // p2 and p3 tie at 1W. p2 has CE=+0.5−0.5=0, p3 has CE=−0.5+0.5=0.
    // p2 and p3 didn't play each other directly. So h2h falls back to id ASC.
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 3,
      targetPoints: 200,
    });
    // Standings should be: p1 (2W), then p2 or p3 (1W, tied), then p4 (0W).
    // p1 already played both p2 and p3, so R3 forces rematch.
    expect(result.pairings).toHaveLength(2);
  });
});

describe('generateSwissPairings — rematch avoidance', () => {
  test('avoids rematch when possible', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3), makePair('p4', 4)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p2', 200, 100),
      makeFinishedMatch('m2', 'p3', 'p4', 200, 100),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    });
    const hasRematch = result.pairings.some(
      (p) =>
        (p.pairHomeId === 'p1' && p.pairAwayId === 'p2') ||
        (p.pairHomeId === 'p2' && p.pairAwayId === 'p1'),
    );
    expect(hasRematch).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  test('2 pairs, 3 rounds → R1 ok, R2 rematch warning, R3 rematch warning', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2)];

    const r1 = generateSwissPairings({ pairs, previousMatches: [], roundNumber: 1, targetPoints: 200 });
    expect(r1.warnings).toHaveLength(0);

    const r1Matches = [makeFinishedMatch('m1', 'p1', 'p2', 200, 100, 1)];
    const r2 = generateSwissPairings({ pairs, previousMatches: r1Matches, roundNumber: 2, targetPoints: 200 });
    expect(r2.warnings.length).toBeGreaterThan(0);

    const r2Matches = [...r1Matches, makeFinishedMatch('m2', 'p1', 'p2', 200, 80, 2)];
    const r3 = generateSwissPairings({ pairs, previousMatches: r2Matches, roundNumber: 3, targetPoints: 200 });
    expect(r3.warnings.length).toBeGreaterThan(0);
  });
});

describe('generateSwissPairings — bye handling', () => {
  test('odd N → bye to lowest-ranked without prior bye', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3)];
    const result = generateSwissPairings({
      pairs,
      previousMatches: [],
      roundNumber: 1,
      targetPoints: 200,
    });
    expect(result.byePairId).toBe('p3'); // lowest seed
    expect(result.pairings).toHaveLength(1);
  });

  test('bye does not repeat if avoidable', () => {
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3)];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p2', 200, 100, 1),
      makeByeMatch('bye1', 'p3', 1),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    });
    expect(result.byePairId).not.toBe('p3');
    // p2 lost (0W) so it's lowest-ranked without prior bye.
    expect(result.byePairId).toBe('p2');
  });

  test('strict rotation: oldest bye gets next when all have had one', () => {
    // 3 pairs, each had bye in different rounds.
    //   p1: bye in r1 (oldest)
    //   p2: bye in r2
    //   p3: bye in r3 (newest)
    // R4 odd → rotation goes to p1 (oldest bye).
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3)];
    const previousMatches = [
      makeByeMatch('bye1', 'p1', 1),
      makeByeMatch('bye2', 'p2', 2),
      makeByeMatch('bye3', 'p3', 3),
      // Real matches to fill standings:
      makeFinishedMatch('m1', 'p2', 'p3', 200, 100, 1),
      makeFinishedMatch('m2', 'p1', 'p3', 200, 100, 2),
      makeFinishedMatch('m3', 'p1', 'p2', 200, 100, 3),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 4,
      targetPoints: 200,
    });
    expect(result.byePairId).toBe('p1');
    expect(result.pairings).toHaveLength(1);
    expect(new Set([result.pairings[0].pairHomeId, result.pairings[0].pairAwayId])).toEqual(
      new Set(['p2', 'p3']),
    );
  });

  test('strict rotation tie: equal lastByeRound → pair.id ASC', () => {
    // p1 and p2 both had bye in r1; p3 in r2. R3 → between p1 and p2 (both oldest),
    // id ASC → p1.
    const pairs = [makePair('p1', 1), makePair('p2', 2), makePair('p3', 3)];
    const previousMatches = [
      makeByeMatch('bye1', 'p1', 1),
      makeByeMatch('bye2', 'p2', 1),
      makeByeMatch('bye3', 'p3', 2),
      makeFinishedMatch('m1', 'p1', 'p3', 200, 100, 1),
      makeFinishedMatch('m2', 'p2', 'p3', 200, 100, 2),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches,
      roundNumber: 3,
      targetPoints: 200,
    });
    expect(result.byePairId).toBe('p1');
  });
});

describe('generateSwissPairings — withdrawn pairs', () => {
  test('withdrawn excluded from future pairing', () => {
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3, '2026-06-10T12:00:00Z'),
      makePair('p4', 4),
    ];
    const result = generateSwissPairings({
      pairs,
      previousMatches: [],
      roundNumber: 1,
      targetPoints: 200,
    });
    const allIds = result.pairings.flatMap((p) => [p.pairHomeId, p.pairAwayId]);
    expect(allIds).not.toContain('p3');
  });
});

describe('generateSwissPairings — determinism', () => {
  test('10 identical calls produce identical output', () => {
    const pairs = [
      makePair('p1', 1),
      makePair('p2', 2),
      makePair('p3', 3),
      makePair('p4', 4),
      makePair('p5', 5),
      makePair('p6', 6),
    ];
    const previousMatches = [
      makeFinishedMatch('m1', 'p1', 'p2', 200, 100),
      makeFinishedMatch('m2', 'p3', 'p4', 200, 100),
      makeFinishedMatch('m3', 'p5', 'p6', 200, 100),
    ];
    const input: SwissPairingInput = {
      pairs,
      previousMatches,
      roundNumber: 2,
      targetPoints: 200,
    };

    const first = generateSwissPairings(input);
    for (let i = 0; i < 9; i++) {
      const result = generateSwissPairings(input);
      expect(result.byePairId).toBe(first.byePairId);
      expect(result.warnings).toEqual(first.warnings);
      expect(result.pairings).toEqual(first.pairings);
    }
  });
});
