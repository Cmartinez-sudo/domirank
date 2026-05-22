import { describe, it, expect } from 'vitest';
import { validateMatchClosure } from './match-validation';

describe('validateMatchClosure', () => {
  it('0, 0, 100 → in_progress', () => {
    expect(validateMatchClosure(0, 0, 100)).toEqual({
      status: 'in_progress',
      reason: 'goal_not_reached',
    });
  });

  it('50, 50, 100 → in_progress', () => {
    expect(validateMatchClosure(50, 50, 100)).toEqual({
      status: 'in_progress',
      reason: 'goal_not_reached',
    });
  });

  it('100, 100, 100 → tied_at_goal', () => {
    expect(validateMatchClosure(100, 100, 100)).toEqual({
      status: 'tied_at_goal',
      reason: 'must_play_tiebreaker',
    });
  });

  it('135, 88, 100 → finishable, winnerTeam: 1 (el caso del bug)', () => {
    expect(validateMatchClosure(135, 88, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 1,
    });
  });

  it('100, 99, 100 → finishable, winnerTeam: 1', () => {
    expect(validateMatchClosure(100, 99, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 1,
    });
  });

  it('100, 105, 100 → finishable, winnerTeam: 2', () => {
    expect(validateMatchClosure(100, 105, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 2,
    });
  });

  it('200, 150, 100 → finishable, winnerTeam: 1', () => {
    expect(validateMatchClosure(200, 150, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 1,
    });
  });

  it('"135" as any, 88, 100 → finishable, winnerTeam: 1 (coerción de tipo)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateMatchClosure('135' as any, 88, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 1,
    });
  });
});
