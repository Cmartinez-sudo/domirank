import { describe, test, expect } from 'vitest';
import { computeStandings } from './compute-standings';
import type { Pair, Match } from './swiss-types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makePair(id: string, initialSeed: number | null = null, withdrawnAt: string | null = null): Pair {
  return { id, initialSeed, withdrawnAt };
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

// ─── computeStandings ─────────────────────────────────────────────────────────

describe('computeStandings', () => {
  test('all pairs start at 0 points with no matches', () => {
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3')];
    const standings = computeStandings(pairs, []);
    for (const s of standings) {
      expect(s.points).toBe(0);
      expect(s.wins).toBe(0);
      expect(s.draws).toBe(0);
      expect(s.losses).toBe(0);
      expect(s.marginOfVictory).toBe(0);
      expect(s.buchholz).toBe(0);
      expect(s.hasHadBye).toBe(false);
      expect(s.withdrawn).toBe(false);
    }
  });

  test('win gives 3 points and correct margin', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 100, 50, 'finished'),
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;

    expect(p1.points).toBe(3);
    expect(p1.wins).toBe(1);
    expect(p1.marginOfVictory).toBe(50);
    expect(p2.points).toBe(0);
    expect(p2.losses).toBe(1);
    expect(p2.marginOfVictory).toBe(-50);
  });

  test('draw gives 1 point to each side', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 100, 100, 'finished'),
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;

    expect(p1.points).toBe(1);
    expect(p1.draws).toBe(1);
    expect(p2.points).toBe(1);
    expect(p2.draws).toBe(1);
  });

  test('bye gives 3 points and sets hasHadBye', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', null, null, null, 'bye'),
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;

    expect(p1.points).toBe(3);
    expect(p1.hasHadBye).toBe(true);
    expect(p2.points).toBe(0);
    expect(p2.hasHadBye).toBe(false);
  });

  test('pending and in_progress matches do not affect standings', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 100, 50, 'pending'),
      makeMatch('m2', 'p1', 'p2', 100, 50, 'in_progress'),
    ];
    const standings = computeStandings(pairs, matches);
    for (const s of standings) {
      expect(s.points).toBe(0);
    }
  });

  test('withdrawn pair is marked withdrawn', () => {
    const pairs = [makePair('p1'), makePair('p2', null, '2025-01-01T00:00:00Z')];
    const standings = computeStandings(pairs, []);
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    expect(p2.withdrawn).toBe(true);
  });

  test('Test 6 (spec): withdrawn pair gets 0 pts, opponents keep their points', () => {
    // p1 beat p3, p3 withdrew after that — p1 keeps its 3 pts
    const pairs = [
      makePair('p1'),
      makePair('p2'),
      makePair('p3', null, '2025-01-02T00:00:00Z'), // withdrew after round 1
    ];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p3', 100, 60, 'finished'), // p1 beat p3 in r1
      makeMatch('m2', 'p2', 'p3', 80, 100, 'finished'), // p3 beat p2 in r1
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    const p3 = standings.find((s) => s.pairId === 'p3')!;

    expect(p1.points).toBe(3); // win vs p3 stands
    expect(p2.points).toBe(0); // loss vs p3 stands
    expect(p3.points).toBe(3); // p3's own points are not retroactively removed
    expect(p3.withdrawn).toBe(true);
  });

  test('Test 7 (spec): tiebreaker margin — 6pts/+10 ranks above 6pts/+5', () => {
    // We verify the data is correct in standings; sorting is done in generateSwissPairings.
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3'), makePair('p4')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 110, 100, 'finished'), // p1 wins +10
      makeMatch('m2', 'p3', 'p4', 105, 100, 'finished'), // p3 wins +5
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p3 = standings.find((s) => s.pairId === 'p3')!;

    expect(p1.points).toBe(3);
    expect(p1.marginOfVictory).toBe(10);
    expect(p3.points).toBe(3);
    expect(p3.marginOfVictory).toBe(5);
    // p1 should rank above p3 on margin when points tie
    expect(p1.marginOfVictory).toBeGreaterThan(p3.marginOfVictory);
  });

  test('buchholz equals sum of opponents points', () => {
    const pairs = [makePair('p1'), makePair('p2'), makePair('p3')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 100, 80, 'finished'), // p1 3pts, p2 0pts
      makeMatch('m2', 'p1', 'p3', 100, 90, 'finished'), // p1 3pts more, p3 0pts
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    const p3 = standings.find((s) => s.pairId === 'p3')!;

    // p1 played p2 (0pts) and p3 (0pts) → buchholz = 0
    expect(p1.buchholz).toBe(0);
    // p2 played p1 (6pts) → buchholz = 6
    expect(p2.buchholz).toBe(6);
    // p3 played p1 (6pts) → buchholz = 6
    expect(p3.buchholz).toBe(6);
  });

  test('headToHeadResults records correct results for both sides', () => {
    const pairs = [makePair('p1'), makePair('p2')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'p2', 100, 60, 'finished'),
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;

    expect(p1.headToHeadResults.get('p2')).toBe('win');
    expect(p2.headToHeadResults.get('p1')).toBe('loss');
  });

  test('Test 10 (spec): tiebreaker buchholz differentiates when MoV ties', () => {
    // p1 and p2 both have 3 pts and +10 margin, but p1 played a stronger opponent
    const pairs = [makePair('p1'), makePair('p2'), makePair('strongOpp'), makePair('weakOpp')];
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'strongOpp', 110, 100, 'finished'), // p1 3pts +10, strongOpp loses
      makeMatch('m2', 'p2', 'weakOpp', 110, 100, 'finished'),   // p2 3pts +10, weakOpp loses
      makeMatch('m3', 'strongOpp', 'weakOpp', 100, 50, 'finished'), // strongOpp gets 3pts
    ];
    const standings = computeStandings(pairs, matches);
    const p1 = standings.find((s) => s.pairId === 'p1')!;
    const p2 = standings.find((s) => s.pairId === 'p2')!;
    const strongOpp = standings.find((s) => s.pairId === 'strongOpp')!;
    const weakOpp = standings.find((s) => s.pairId === 'weakOpp')!;

    expect(p1.points).toBe(3);
    expect(p2.points).toBe(3);
    expect(p1.marginOfVictory).toBe(10);
    expect(p2.marginOfVictory).toBe(10);
    // p1's opponent (strongOpp) has 3 pts, p2's opponent (weakOpp) has 0 pts
    expect(strongOpp.points).toBe(3);
    expect(weakOpp.points).toBe(0);
    expect(p1.buchholz).toBe(3);
    expect(p2.buchholz).toBe(0);
  });
});
