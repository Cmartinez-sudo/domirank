/**
 * Tests para la lógica de asignación de mesas (num_boards) en el
 * motor de pairings de torneos.
 *
 * Verifica que:
 *   1. Con num_boards=1, todas las partidas quedan en mesa 1.
 *   2. Con num_boards=2, las partidas se distribuyen round-robin: 1,2,1,2,...
 *   3. Con num_boards=4 y 4 partidas, cada partida tiene su propia mesa.
 *   4. Con num_boards=2 y 1 partida, queda en mesa 1.
 *   5. El schema acepta/rechaza num_boards correctamente.
 */

import { describe, it, expect } from 'vitest';
import { createTournamentSchema } from '../tournament-schema';

// ─── Función pura extraída del engine para testear en aislamiento ─────────────

function assignBoard(matchIndexInRound: number, numBoards: number): number {
  return (matchIndexInRound % numBoards) + 1;
}

// ─── Tests de assignBoard ─────────────────────────────────────────────────────

describe('assignBoard — distribución de mesas round-robin', () => {
  it('con 1 mesa: todas las partidas van a mesa 1', () => {
    expect(assignBoard(0, 1)).toBe(1);
    expect(assignBoard(1, 1)).toBe(1);
    expect(assignBoard(5, 1)).toBe(1);
  });

  it('con 2 mesas: distribución 1,2,1,2,...', () => {
    expect(assignBoard(0, 2)).toBe(1);
    expect(assignBoard(1, 2)).toBe(2);
    expect(assignBoard(2, 2)).toBe(1);
    expect(assignBoard(3, 2)).toBe(2);
  });

  it('con 4 mesas y 4 partidas: cada partida tiene su propia mesa', () => {
    expect(assignBoard(0, 4)).toBe(1);
    expect(assignBoard(1, 4)).toBe(2);
    expect(assignBoard(2, 4)).toBe(3);
    expect(assignBoard(3, 4)).toBe(4);
  });

  it('con 4 mesas y 6 partidas: las últimas 2 vuelven a mesa 1 y 2', () => {
    expect(assignBoard(4, 4)).toBe(1);
    expect(assignBoard(5, 4)).toBe(2);
  });

  it('siempre devuelve al menos mesa 1 (nunca 0)', () => {
    for (let i = 0; i < 16; i++) {
      for (let b = 1; b <= 16; b++) {
        expect(assignBoard(i, b)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('nunca supera num_boards', () => {
    for (let i = 0; i < 16; i++) {
      for (let b = 1; b <= 16; b++) {
        expect(assignBoard(i, b)).toBeLessThanOrEqual(b);
      }
    }
  });
});

// ─── Tests de createTournamentSchema con num_boards ───────────────────────────

const VALID_BASE = {
  name: 'Copa Venezuela 2026',
  visibility: 'public' as const,
  format: 'swiss' as const,
  modality: 'ven' as const,
  max_players: 8,
  inscription_mode: 'pre_formed' as const,
  time_limit_minutes: 30,
};

describe('createTournamentSchema — num_boards', () => {
  it('acepta num_boards 1 (default)', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, num_boards: 1 }).success).toBe(true);
  });

  it('acepta num_boards 16 (máximo)', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, num_boards: 16 }).success).toBe(true);
  });

  it('rechaza num_boards 0', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, num_boards: 0 }).success).toBe(false);
  });

  it('rechaza num_boards 17', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, num_boards: 17 }).success).toBe(false);
  });

  it('rechaza num_boards negativo', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, num_boards: -1 }).success).toBe(false);
  });

  it('usa default 1 cuando num_boards está ausente', () => {
    const result = createTournamentSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.num_boards).toBe(1);
    }
  });

  it('acepta num_boards como parte de input completo válido', () => {
    const input = {
      ...VALID_BASE,
      num_boards: 4,
      description: 'Torneo con 4 mesas',
    };
    const result = createTournamentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.num_boards).toBe(4);
    }
  });
});

// ─── Integración: simular generación de pairings con num_boards ───────────────

type Matchup = { round: number; board: number; teamAIdx: number; teamBIdx: number };

/**
 * Versión simplificada del algoritmo round-robin usando assignBoard.
 * Replica exactamente la lógica del engine para verificar distribución.
 */
function generateRoundRobinWithBoards(numTeams: number, numBoards: number): Matchup[] {
  const n = numTeams % 2 === 0 ? numTeams : numTeams + 1;
  const rounds = n - 1;
  const rotate = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const result: Matchup[] = [];

  for (let r = 0; r < rounds; r++) {
    const circle = [0, ...rotate];
    let matchIdx = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a < numTeams && b < numTeams) {
        result.push({ round: r + 1, board: assignBoard(matchIdx, numBoards), teamAIdx: a, teamBIdx: b });
        matchIdx++;
      }
    }
    rotate.push(rotate.shift()!);
  }
  return result;
}

describe('round-robin con num_boards', () => {
  it('4 equipos, 1 mesa: todos en mesa 1', () => {
    const matchups = generateRoundRobinWithBoards(4, 1);
    for (const m of matchups) {
      expect(m.board).toBe(1);
    }
  });

  it('4 equipos, 2 mesas: las 2 partidas por ronda usan mesa 1 y 2 respectivamente', () => {
    const matchups = generateRoundRobinWithBoards(4, 2);
    // 4 equipos → 3 rondas de 2 partidas
    const rounds = [1, 2, 3];
    for (const r of rounds) {
      const rMatchups = matchups.filter((m) => m.round === r);
      expect(rMatchups).toHaveLength(2);
      expect(rMatchups[0].board).toBe(1);
      expect(rMatchups[1].board).toBe(2);
    }
  });

  it('6 equipos, 3 mesas: 3 partidas por ronda, cada una en distinta mesa', () => {
    const matchups = generateRoundRobinWithBoards(6, 3);
    const rounds = [1, 2, 3, 4, 5];
    for (const r of rounds) {
      const rMatchups = matchups.filter((m) => m.round === r);
      expect(rMatchups).toHaveLength(3);
      expect(rMatchups[0].board).toBe(1);
      expect(rMatchups[1].board).toBe(2);
      expect(rMatchups[2].board).toBe(3);
    }
  });

  it('8 equipos, 2 mesas: 4 partidas por ronda, mesas 1,2,1,2', () => {
    const matchups = generateRoundRobinWithBoards(8, 2);
    for (const r of [1, 2, 3, 4, 5, 6, 7]) {
      const rMatchups = matchups.filter((m) => m.round === r);
      expect(rMatchups).toHaveLength(4);
      expect(rMatchups[0].board).toBe(1);
      expect(rMatchups[1].board).toBe(2);
      expect(rMatchups[2].board).toBe(1);
      expect(rMatchups[3].board).toBe(2);
    }
  });
});
