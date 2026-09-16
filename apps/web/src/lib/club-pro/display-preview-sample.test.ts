import { describe, expect, it } from 'vitest';
import {
  SAMPLE_MATCHES,
  SAMPLE_PAIRS,
  SAMPLE_ROUNDS,
  SAMPLE_SPONSORS,
  SAMPLE_TOURNAMENT,
} from './display-preview-sample';

/**
 * Smoke tests for the editor preview fixture. Catches drift between
 * the fixture and the DisplayShell's expected shapes / invariants:
 *   - Rounds are numbered 1..N without gaps.
 *   - Every match references an existing pair id.
 *   - Every match belongs to an existing round id.
 *   - Sponsor positions are unique and start at 1.
 */

describe('display preview sample fixture', () => {
  it('rounds are numbered 1..N sequentially', () => {
    const numbers = SAMPLE_ROUNDS.map((r) => r.round_number).sort((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, idx) => idx + 1));
  });

  it('current_round_number matches an existing round', () => {
    const currentRound = SAMPLE_ROUNDS.find(
      (r) => r.round_number === SAMPLE_TOURNAMENT.current_round_number,
    );
    expect(currentRound).toBeDefined();
  });

  it('every match references an existing home pair', () => {
    const pairIds = new Set(SAMPLE_PAIRS.map((p) => p.id));
    for (const match of SAMPLE_MATCHES) {
      expect(pairIds.has(match.pair_home_id)).toBe(true);
    }
  });

  it('every match with an away pair references an existing pair', () => {
    const pairIds = new Set(SAMPLE_PAIRS.map((p) => p.id));
    for (const match of SAMPLE_MATCHES) {
      if (match.pair_away_id !== null) {
        expect(pairIds.has(match.pair_away_id)).toBe(true);
      }
    }
  });

  it('every match belongs to an existing round', () => {
    const roundIds = new Set(SAMPLE_ROUNDS.map((r) => r.id));
    for (const match of SAMPLE_MATCHES) {
      expect(roundIds.has(match.round_id)).toBe(true);
    }
  });

  it('sponsor positions are unique and start at 1', () => {
    const positions = SAMPLE_SPONSORS.map((s) => s.position);
    expect(new Set(positions).size).toBe(positions.length);
    expect(Math.min(...positions)).toBe(1);
  });
});
