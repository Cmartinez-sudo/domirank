import { describe, it, expect } from 'vitest';
import { bergerSchedule } from '../berger-schedule';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrae los matchups reales (sin byes) de una ronda concreta. */
function realMatchups(schedule: ReturnType<typeof bergerSchedule>, round: number) {
  return schedule.filter((m) => m.round === round && !m.isBye);
}

/** Cuenta cuántas veces el equipo `idx` aparece en el schedule (sin byes). */
function countAppearances(schedule: ReturnType<typeof bergerSchedule>, idx: number): number {
  return schedule.filter(
    (m) => !m.isBye && (m.teamAIndex === idx || m.teamBIndex === idx),
  ).length;
}

/** Verifica que cada par (A, B) aparece exactamente una vez en todo el schedule. */
function hasDuplicatePairs(schedule: ReturnType<typeof bergerSchedule>): boolean {
  const seen = new Set<string>();
  for (const m of schedule) {
    if (m.isBye) continue;
    const key = [Math.min(m.teamAIndex, m.teamBIndex), Math.max(m.teamAIndex, m.teamBIndex)].join('-');
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bergerSchedule — 2 equipos', () => {
  const schedule = bergerSchedule(2);

  it('genera 1 ronda (n par, n-1 = 1)', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(1);
  });

  it('genera 1 matchup (sin byes)', () => {
    expect(schedule.filter((m) => !m.isBye)).toHaveLength(1);
  });

  it('matchup es 0 vs 1', () => {
    const m = schedule[0];
    expect([m.teamAIndex, m.teamBIndex].sort()).toEqual([0, 1]);
  });
});

describe('bergerSchedule — 4 equipos (caso par)', () => {
  const schedule = bergerSchedule(4);

  it('genera 3 rondas (n-1 = 3)', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(3);
  });

  it('genera 2 matchups reales por ronda', () => {
    for (let r = 1; r <= 3; r++) {
      expect(realMatchups(schedule, r)).toHaveLength(2);
    }
  });

  it('cada equipo juega exactamente 3 partidas en total', () => {
    for (let i = 0; i < 4; i++) {
      expect(countAppearances(schedule, i)).toBe(3);
    }
  });

  it('no hay parejas repetidas', () => {
    expect(hasDuplicatePairs(schedule)).toBe(false);
  });

  it('total de matchups = 6 (C(4,2))', () => {
    expect(schedule.filter((m) => !m.isBye)).toHaveLength(6);
  });
});

describe('bergerSchedule — 6 equipos (caso par)', () => {
  const schedule = bergerSchedule(6);

  it('genera 5 rondas (n-1 = 5)', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(5);
  });

  it('genera 3 matchups reales por ronda', () => {
    for (let r = 1; r <= 5; r++) {
      expect(realMatchups(schedule, r)).toHaveLength(3);
    }
  });

  it('cada equipo juega exactamente 5 partidas', () => {
    for (let i = 0; i < 6; i++) {
      expect(countAppearances(schedule, i)).toBe(5);
    }
  });

  it('no hay parejas repetidas', () => {
    expect(hasDuplicatePairs(schedule)).toBe(false);
  });

  it('total de matchups = 15 (C(6,2))', () => {
    expect(schedule.filter((m) => !m.isBye)).toHaveLength(15);
  });
});

describe('bergerSchedule — 8 equipos (caso par)', () => {
  const schedule = bergerSchedule(8);

  it('genera 7 rondas (n-1 = 7)', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(7);
  });

  it('genera 4 matchups reales por ronda', () => {
    for (let r = 1; r <= 7; r++) {
      expect(realMatchups(schedule, r)).toHaveLength(4);
    }
  });

  it('cada equipo juega exactamente 7 partidas', () => {
    for (let i = 0; i < 8; i++) {
      expect(countAppearances(schedule, i)).toBe(7);
    }
  });

  it('no hay parejas repetidas', () => {
    expect(hasDuplicatePairs(schedule)).toBe(false);
  });

  it('total de matchups = 28 (C(8,2))', () => {
    expect(schedule.filter((m) => !m.isBye)).toHaveLength(28);
  });
});

describe('bergerSchedule — 3 equipos (caso impar, con bye)', () => {
  const schedule = bergerSchedule(3);

  it('genera 3 rondas (n impar → n rondas con bye)', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(3);
  });

  it('cada ronda tiene 1 matchup real y 1 bye', () => {
    for (let r = 1; r <= 3; r++) {
      const all = schedule.filter((m) => m.round === r);
      expect(all).toHaveLength(2); // n/2 = 4/2 = 2 slots
      expect(realMatchups(schedule, r)).toHaveLength(1);
      expect(all.filter((m) => m.isBye)).toHaveLength(1);
    }
  });

  it('cada equipo real juega exactamente 2 partidas (no contra BYE)', () => {
    for (let i = 0; i < 3; i++) {
      expect(countAppearances(schedule, i)).toBe(2);
    }
  });

  it('no hay parejas reales repetidas', () => {
    expect(hasDuplicatePairs(schedule)).toBe(false);
  });
});

describe('bergerSchedule — 5 equipos (caso impar, con bye)', () => {
  const schedule = bergerSchedule(5);

  it('genera 5 rondas', () => {
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(5);
  });

  it('cada equipo real juega exactamente 4 partidas (sin byes)', () => {
    for (let i = 0; i < 5; i++) {
      expect(countAppearances(schedule, i)).toBe(4);
    }
  });

  it('no hay parejas reales repetidas', () => {
    expect(hasDuplicatePairs(schedule)).toBe(false);
  });
});

describe('bergerSchedule — edge cases', () => {
  it('0 equipos → array vacío', () => {
    expect(bergerSchedule(0)).toEqual([]);
  });

  it('1 equipo → array vacío', () => {
    expect(bergerSchedule(1)).toEqual([]);
  });

  it('isBye es false para todos los matchups en 4 equipos', () => {
    const schedule = bergerSchedule(4);
    expect(schedule.every((m) => !m.isBye)).toBe(true);
  });

  it('board numbers empiezan en 1 y son consecutivos por ronda', () => {
    const schedule = bergerSchedule(6);
    for (let r = 1; r <= 5; r++) {
      const boards = schedule.filter((m) => m.round === r).map((m) => m.board).sort((a, b) => a - b);
      expect(boards).toEqual([1, 2, 3]);
    }
  });
});
