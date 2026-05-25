import { describe, it, expect } from 'vitest';
import { validateMatchClosure } from './match-validation';

describe('validateMatchClosure — sin timeExpired (comportamiento original)', () => {
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
    // eslint-disable-next-line
    expect(validateMatchClosure('135' as any, 88, 100)).toEqual({
      status: 'finishable',
      winnerTeam: 1,
    });
  });

  it('timeExpired=false explícito no cambia el comportamiento de in_progress', () => {
    expect(validateMatchClosure(40, 60, 100, false)).toEqual({
      status: 'in_progress',
      reason: 'goal_not_reached',
    });
  });
});

describe('validateMatchClosure — timeExpired=true', () => {
  it('70, 50, 100 + timeExpired → time_expired_finishable, winnerTeam: 1', () => {
    expect(validateMatchClosure(70, 50, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: 1,
    });
  });

  it('40, 80, 100 + timeExpired → time_expired_finishable, winnerTeam: 2', () => {
    expect(validateMatchClosure(40, 80, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: 2,
    });
  });

  it('50, 50, 100 + timeExpired (empate) → time_expired_finishable, winnerTeam: null', () => {
    expect(validateMatchClosure(50, 50, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: null,
    });
  });

  it('0, 0, 100 + timeExpired (empate en 0) → time_expired_finishable, winnerTeam: null', () => {
    expect(validateMatchClosure(0, 0, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: null,
    });
  });

  it('meta ya alcanzada con timeExpired → timeExpired toma precedencia, resuelve por puntaje', () => {
    // timeExpired ignora la meta y resuelve siempre por mayor puntaje
    expect(validateMatchClosure(100, 60, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: 1,
    });
  });

  it('ambos superan meta con timeExpired y diferencia → time_expired_finishable por mayor puntaje', () => {
    expect(validateMatchClosure(110, 105, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: 1,
    });
  });

  it('ambos superan meta empatados con timeExpired → time_expired_finishable, winnerTeam: null', () => {
    expect(validateMatchClosure(105, 105, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: null,
    });
  });

  it('coerción de tipo funciona con timeExpired', () => {
    // eslint-disable-next-line
    expect(validateMatchClosure('70' as any, '30' as any, 100, true)).toEqual({
      status: 'time_expired_finishable',
      winnerTeam: 1,
    });
  });
});
