import { describe, test, expect } from 'vitest';
import { computeStandings } from './compute-standings';
import type { Pair, Match } from './swiss-types';

function makePair(id: string, withdrawnAt: string | null = null): Pair {
  return { id, initialSeed: null, withdrawnAt };
}

function makeMatch(
  id: string,
  pairHomeId: string,
  pairAwayId: string | null,
  homeScore: number | null,
  awayScore: number | null,
  status: Match['status'],
  roundNumber: number = 1,
): Match {
  return { id, pairHomeId, pairAwayId, pairHomeScore: homeScore, pairAwayScore: awayScore, status, roundNumber };
}

describe('computeStandings — zero state', () => {
  test('all pairs start at 0 with no matches', () => {
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3')];
    const standings = computeStandings(pairs, [], 200);
    for (const s of standings) {
      expect(s.wins).toBe(0);
      expect(s.losses).toBe(0);
      expect(s.effectivenessCoefficient).toBe(0);
      expect(s.pointsScored).toBe(0);
      expect(s.pointsConceded).toBe(0);
      expect(s.hasHadBye).toBe(false);
      expect(s.lastByeRound).toBeNull();
      expect(s.withdrawn).toBe(false);
    }
  });

  test('throws if targetPoints <= 0', () => {
    expect(() => computeStandings([makePair('p1')], [], 0)).toThrow();
    expect(() => computeStandings([makePair('p1')], [], -5)).toThrow();
  });
});

describe('computeStandings — scoring with CE formula', () => {
  test('200-150 with target=200: CE = ±0.25', () => {
    // CE = 1 − loserScore / target = 1 − 150/200 = 0.25
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 200, 150, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;

    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p1.effectivenessCoefficient).toBeCloseTo(0.25, 5);
    expect(p1.pointsScored).toBe(200);
    expect(p1.pointsConceded).toBe(150);

    expect(p2.wins).toBe(0);
    expect(p2.losses).toBe(1);
    expect(p2.effectivenessCoefficient).toBeCloseTo(-0.25, 5);
    expect(p2.pointsScored).toBe(150);
    expect(p2.pointsConceded).toBe(200);
  });

  test('shutout 200-0 → CE = ±1.0 (max efficiency)', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 200, 0, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    expect(standings.find((s) => s.pairId === 'p1')!.effectivenessCoefficient).toBeCloseTo(1.0, 5);
    expect(standings.find((s) => s.pairId === 'p2')!.effectivenessCoefficient).toBeCloseTo(-1.0, 5);
  });

  test('tight match 200-195 → CE = ±0.025 (minimum efficiency)', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 200, 195, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    expect(standings.find((s) => s.pairId === 'p1')!.effectivenessCoefficient).toBeCloseTo(0.025, 5);
    expect(standings.find((s) => s.pairId === 'p2')!.effectivenessCoefficient).toBeCloseTo(-0.025, 5);
  });
});

describe('computeStandings — no score cap (winner score is raw)', () => {
  test('winner 380 with target=350 → pointsScored is the raw 380, not capped', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 380, 280, 'finished')];
    const standings = computeStandings(pairs, matches, 350);
    expect(standings.find((s) => s.pairId === 'p1')!.pointsScored).toBe(380);
    expect(standings.find((s) => s.pairId === 'p2')!.pointsScored).toBe(280);
    // pointsConceded of loser is the raw winner score (380).
    expect(standings.find((s) => s.pairId === 'p2')!.pointsConceded).toBe(380);
    // CE uses loser score raw: 1 - 280/350.
    expect(standings.find((s) => s.pairId === 'p1')!.effectivenessCoefficient).toBeCloseTo(
      1 - 280 / 350,
      5,
    );
  });

  test('classic 95→129 closing hand: winner pointsScored is 129', () => {
    // Domino target 100: pair leads 95-94. Closing hand awards 34 → final 129.
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 129, 94, 'finished')];
    const standings = computeStandings(pairs, matches, 100);
    expect(standings.find((s) => s.pairId === 'p1')!.pointsScored).toBe(129);
    expect(standings.find((s) => s.pairId === 'p2')!.pointsScored).toBe(94);
    // CE: 1 - 94/100 = 0.06
    expect(standings.find((s) => s.pairId === 'p1')!.effectivenessCoefficient).toBeCloseTo(0.06, 5);
  });

  test('under-target winner scores stay as-is', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 150, 80, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    expect(standings.find((s) => s.pairId === 'p1')!.pointsScored).toBe(150);
  });
});

describe('computeStandings — invariants', () => {
  test('throws on finished match with equal scores (no draws in formal domino)', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 100, 100, 'finished')];
    expect(() => computeStandings(pairs, matches, 200)).toThrow(/equal scores|Draws are not allowed/i);
  });

  test('pending and in_progress matches are ignored', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [
      makeMatch('m1', 'p1', 'p2', 200, 100, 'pending'),
      makeMatch('m2', 'p1', 'p2', 200, 100, 'in_progress'),
    ];
    const standings = computeStandings(pairs, matches, 200);
    for (const s of standings) expect(s.wins).toBe(0);
  });
});

describe('computeStandings — byes', () => {
  test('bye gives +1 win, 0 CE, 0 pointsScored, sets hasHadBye and lastByeRound', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', null, null, null, 'bye', 3)];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p1.effectivenessCoefficient).toBe(0);
    expect(p1.pointsScored).toBe(0);
    expect(p1.pointsConceded).toBe(0);
    expect(p1.hasHadBye).toBe(true);
    expect(p1.lastByeRound).toBe(3);
  });

  test('multiple byes track most recent round', () => {
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3')];
    const matches = [
      makeMatch('b1', 'p1', null, null, null, 'bye', 1),
      makeMatch('b2', 'p1', null, null, null, 'bye', 4),
      makeMatch('b3', 'p1', null, null, null, 'bye', 2),
    ];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    expect(p1.wins).toBe(3);
    expect(p1.lastByeRound).toBe(4);
  });
});

describe('computeStandings — algebraic CE accumulation', () => {
  test('CE sums algebraically across multiple matches', () => {
    // p1 wins 200-100 (CE +0.5), then loses 100-200 (CE -0.5) → net 0
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [
      makeMatch('m1', 'p1', 'p2', 200, 100, 'finished', 1),
      makeMatch('m2', 'p1', 'p2', 100, 200, 'finished', 2),
    ];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(1);
    expect(p1.effectivenessCoefficient).toBeCloseTo(0, 5);
    expect(p2.effectivenessCoefficient).toBeCloseTo(0, 5);
  });
});

describe('computeStandings — withdrawn pairs', () => {
  test('withdrawn pair: past matches still count, flag is set', () => {
    const pairs = [
      makePair('p1'),
      makePair('p2'),
      makePair('p3', '2026-06-10T12:00:00Z'),
    ];
    const matches = [
      makeMatch('m1', 'p1', 'p3', 200, 50, 'finished', 1),
      makeMatch('m2', 'p2', 'p3', 80, 200, 'finished', 1),
    ];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    const p3 = standings.find((s) => s.pairId === 'p3')!;
    expect(p1.wins).toBe(1);
    expect(p2.wins).toBe(0);
    expect(p2.losses).toBe(1);
    expect(p3.wins).toBe(1);
    expect(p3.losses).toBe(1);
    expect(p3.withdrawn).toBe(true);
  });
});

describe('computeStandings — effectivenessPercent', () => {
  test('PF=105, PC=35 → 75.0% (spec example)', () => {
    // p1 wins 105-35 → PF=105, PC=35. Efectividad = 105/(105+35) × 100 = 75.0%
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 105, 35, 'finished')];
    const standings = computeStandings(pairs, matches, 100);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    expect(p1.effectivenessPercent).toBe(75);
    expect(p2.effectivenessPercent).toBe(25);
  });

  test('shutout 200-0 → 100% / 0%', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 200, 0, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    expect(standings.find((s) => s.pairId === 'p1')!.effectivenessPercent).toBe(100);
    expect(standings.find((s) => s.pairId === 'p2')!.effectivenessPercent).toBe(0);
  });

  test('zero matches → 0% (no division by zero)', () => {
    const pairs = [makePair('p1')];
    const standings = computeStandings(pairs, [], 100);
    expect(standings[0].effectivenessPercent).toBe(0);
  });

  test('only bye → 0% (bye does not contribute points)', () => {
    const pairs = [makePair('p1')];
    const matches = [makeMatch('m1', 'p1', null, null, null, 'bye')];
    const standings = computeStandings(pairs, matches, 100);
    expect(standings[0].effectivenessPercent).toBe(0);
  });

  test('does NOT affect ranking (CE remains tiebreaker)', () => {
    // p1: wins 200-50 (CE +0.75, PF=200/PC=50, Efec=80%)
    // p2: wins 200-150 (CE +0.25, PF=200/PC=150, Efec=57.1%)
    // Both have 1 win. CE says p1 > p2. Efec also says p1 > p2 in this
    // case — but they're independent. Sanity check both metrics exist.
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3'), makePair('p4')];
    const matches = [
      makeMatch('m1', 'p1', 'p3', 200, 50, 'finished'),
      makeMatch('m2', 'p2', 'p4', 200, 150, 'finished'),
    ];
    const standings = computeStandings(pairs, matches, 200);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    expect(p1.effectivenessCoefficient).toBeCloseTo(0.75, 5);
    expect(p2.effectivenessCoefficient).toBeCloseTo(0.25, 5);
    expect(p1.effectivenessPercent).toBe(80);
    expect(p2.effectivenessPercent).toBeCloseTo(57.1, 1);
  });
});

describe('computeStandings — head to head', () => {
  test('records win/loss directionally', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches = [makeMatch('m1', 'p1', 'p2', 200, 100, 'finished')];
    const standings = computeStandings(pairs, matches, 200);
    expect(standings.find((s) => s.pairId === 'p1')!.headToHeadResults.get('p2')).toBe('win');
    expect(standings.find((s) => s.pairId === 'p2')!.headToHeadResults.get('p1')).toBe('loss');
  });
});
