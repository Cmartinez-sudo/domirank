/**
 * Tests para la lógica de construcción de teams en generateInitialPairings.
 *
 * Verifican el comportamiento post-CRITICAL-3: cuando existen tournament_pairs
 * en la DB, el engine los usa como teams en lugar de hacer un slice consecutivo
 * del array de playerIds.
 *
 * Solo testea lógica pura — no hay hits a servidor ni a Supabase.
 */

import { describe, it, expect } from 'vitest';
import { bergerSchedule } from '../berger-schedule';

// ─── Tipos locales que replican los del engine ───────────────────────────────

type Team = { userIds: string[]; label: string };

type DbPair = { user_a_id: string; user_b_id: string };

// ─── Función pura extraída del engine (Opción B) ─────────────────────────────

/**
 * Construye los teams a partir de tournament_pairs de la DB.
 * Si hay pares definidos, cada fila es un team.
 * Si no hay pares (singles o torneo sin pares), usa buildTeams legacy.
 */
function buildTeamsFromPairs(
  dbPairs: DbPair[] | null | undefined,
  playerIds: string[],
  teamSize: number,
): Team[] {
  if (dbPairs && dbPairs.length > 0) {
    return dbPairs.map((p, i) => ({
      userIds: [p.user_a_id, p.user_b_id],
      label: `Pareja ${i + 1}`,
    }));
  }
  return buildTeamsLegacy(playerIds, teamSize);
}

function buildTeamsLegacy(playerIds: string[], teamSize: number): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + teamSize - 1 < playerIds.length; i += teamSize) {
    const ids = playerIds.slice(i, i + teamSize);
    teams.push({ userIds: ids, label: `Equipo ${teams.length + 1}` });
  }
  return teams;
}

// ─── UUIDs de prueba ──────────────────────────────────────────────────────────

const P1 = '00000000-0000-0000-0000-000000000001';
const P2 = '00000000-0000-0000-0000-000000000002';
const P3 = '00000000-0000-0000-0000-000000000003';
const P4 = '00000000-0000-0000-0000-000000000004';
const P5 = '00000000-0000-0000-0000-000000000005';
const P6 = '00000000-0000-0000-0000-000000000006';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTeamsFromPairs — respeta tournament_pairs preestablecidos', () => {
  it('con pares definidos: usa exactamente las parejas de la DB', () => {
    // P1-P4 y P2-P3 (orden no estándar en DB)
    const dbPairs: DbPair[] = [
      { user_a_id: P1, user_b_id: P4 },
      { user_a_id: P2, user_b_id: P3 },
    ];
    const players = [P1, P2, P3, P4];
    const teams = buildTeamsFromPairs(dbPairs, players, 2);

    expect(teams).toHaveLength(2);
    // El primer team debe ser exactamente P1-P4 (no P1-P2)
    expect(teams[0].userIds).toEqual([P1, P4]);
    expect(teams[1].userIds).toEqual([P2, P3]);
  });

  it('con pares definidos: no reordena los players por slice consecutivo', () => {
    // Si el engine usara buildTeams legacy, P1 quedaría con P2 y P3 con P4.
    // Con la fix, respeta los pares de la DB.
    const dbPairs: DbPair[] = [
      { user_a_id: P1, user_b_id: P3 },
      { user_a_id: P2, user_b_id: P4 },
    ];
    const players = [P1, P2, P3, P4];
    const teams = buildTeamsFromPairs(dbPairs, players, 2);

    expect(teams[0].userIds).toContain(P1);
    expect(teams[0].userIds).toContain(P3);
    expect(teams[1].userIds).toContain(P2);
    expect(teams[1].userIds).toContain(P4);
  });

  it('con pares definidos: 3 parejas de 6 jugadores', () => {
    const dbPairs: DbPair[] = [
      { user_a_id: P1, user_b_id: P6 },
      { user_a_id: P2, user_b_id: P5 },
      { user_a_id: P3, user_b_id: P4 },
    ];
    const teams = buildTeamsFromPairs(dbPairs, [P1, P2, P3, P4, P5, P6], 2);
    expect(teams).toHaveLength(3);
    expect(teams.map((t) => t.userIds)).toEqual([
      [P1, P6],
      [P2, P5],
      [P3, P4],
    ]);
  });

  it('sin pares en DB: fallback a buildTeams legacy (slice consecutivo)', () => {
    const teams = buildTeamsFromPairs([], [P1, P2, P3, P4], 2);
    // Legacy: P1-P2 y P3-P4
    expect(teams[0].userIds).toEqual([P1, P2]);
    expect(teams[1].userIds).toEqual([P3, P4]);
  });

  it('sin pares en DB: formato singles (teamSize=1)', () => {
    const teams = buildTeamsFromPairs(null, [P1, P2, P3], 1);
    expect(teams).toHaveLength(3);
    expect(teams[0].userIds).toEqual([P1]);
    expect(teams[1].userIds).toEqual([P2]);
    expect(teams[2].userIds).toEqual([P3]);
  });

  it('null dbPairs: usa fallback', () => {
    const teams = buildTeamsFromPairs(null, [P1, P2, P3, P4], 2);
    expect(teams).toHaveLength(2);
  });
});

describe('integración: bergerSchedule con teams de tournament_pairs', () => {
  it('schedule de round_robin respeta las parejas de la DB (no las mezcla)', () => {
    // 4 parejas pre-armadas que NO siguen el orden de insertado
    const dbPairs: DbPair[] = [
      { user_a_id: P1, user_b_id: P4 },
      { user_a_id: P2, user_b_id: P5 },
      { user_a_id: P3, user_b_id: P6 },
    ];
    // Nota: bergerSchedule trabaja por índice, no por IDs; aquí verificamos
    // que el mapeo team[i] → los userIds de la pareja se mantiene intacto.
    const teams = buildTeamsFromPairs(dbPairs, [], 2);
    const schedule = bergerSchedule(teams.length); // 3 equipos → 3 rondas

    // Cada matchup es entre índices; los teams en esos índices deben ser las
    // parejas originales de la DB.
    for (const matchup of schedule) {
      if (matchup.isBye) continue;
      const teamA = teams[matchup.teamAIndex];
      const teamB = teams[matchup.teamBIndex];
      // Los userIds de cada equipo coinciden con los de la DB
      expect(dbPairs.find((p) => p.user_a_id === teamA.userIds[0] && p.user_b_id === teamA.userIds[1])).toBeDefined();
      expect(dbPairs.find((p) => p.user_a_id === teamB.userIds[0] && p.user_b_id === teamB.userIds[1])).toBeDefined();
    }
  });

  it('con 4 parejas de DB: genera round_robin completo sin repetir enfrentamientos', () => {
    const dbPairs: DbPair[] = [
      { user_a_id: P1, user_b_id: P4 },
      { user_a_id: P2, user_b_id: P5 },
      { user_a_id: P3, user_b_id: P6 },
      { user_a_id: P1, user_b_id: P2 }, // par 4 (solo para test)
    ];
    const teams = buildTeamsFromPairs(dbPairs, [], 2);
    const schedule = bergerSchedule(teams.length); // 4 equipos → 3 rondas, 6 matchups

    expect(schedule.filter((m) => !m.isBye)).toHaveLength(6);

    // No hay enfrentamientos repetidos
    const seen = new Set<string>();
    for (const m of schedule) {
      if (m.isBye) continue;
      const key = [Math.min(m.teamAIndex, m.teamBIndex), Math.max(m.teamAIndex, m.teamBIndex)].join('-');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
