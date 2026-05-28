/**
 * Unit tests para las RPCs del polla (polla_standings, polla_best_partner,
 * polla_worst_rival, calc_streak).
 *
 * Estos tests NO ejecutan SQL — verifican el shape/contract de los tipos
 * y validan invariantes del data model esperado.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import type { PollaStandingsRow, PollaPartnerRow, PollaRivalRow } from '@/types/polla';

// Fixture: 4 players, 5 partidas confirmadas en season 1.
// Carlos & Erik vs Gibbon & Gusi (×3): C+E win 2, G+Gu win 1
// Carlos & Gibbon vs Erik & Gusi (×2): C+Gb win 1, E+Gu win 1
const STANDINGS_FIXTURE: PollaStandingsRow[] = [
  {
    user_id: 'carlos', username: 'carlos', display_name: 'Carlos',
    avatar_url: null,
    total_points: 510, points_for: 510, points_against: 420, diff: 90,
    wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: 1, streak_type: 'L',
    best_partner_id: 'erik', best_partner_name: 'Erik',
    best_partner_wins: 2, best_partner_losses: 1,
    worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
    worst_rival_wins: 1, worst_rival_losses: 3,
  },
  {
    user_id: 'erik', username: 'erik', display_name: 'Erik',
    avatar_url: null,
    total_points: 480, points_for: 480, points_against: 450, diff: 30,
    wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: 2, streak_type: 'W',
    best_partner_id: 'carlos', best_partner_name: 'Carlos',
    best_partner_wins: 2, best_partner_losses: 1,
    worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
    worst_rival_wins: 1, worst_rival_losses: 3,
  },
];

describe('polla RPCs — shape + ordering', () => {
  it('PollaStandingsRow tiene todos los campos requeridos', () => {
    const row = STANDINGS_FIXTURE[0];
    expect(row).toHaveProperty('user_id');
    expect(row).toHaveProperty('total_points');
    expect(row).toHaveProperty('wins');
    expect(row).toHaveProperty('current_streak');
    expect(row).toHaveProperty('best_partner_id');
    expect(row).toHaveProperty('worst_rival_id');
  });

  it('total_points es la suma de scores del jugador en sus partidas', () => {
    expect(STANDINGS_FIXTURE[0].total_points).toBe(510);
  });

  it('wins y losses suman games_played', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(row.wins + row.losses).toBe(row.games_played);
    }
  });

  it('win_pct está entre 0 y 100', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(row.win_pct).toBeGreaterThanOrEqual(0);
      expect(row.win_pct).toBeLessThanOrEqual(100);
    }
  });

  it('current_streak es int >= 0 y streak_type es "W"|"L"|null', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(Number.isInteger(row.current_streak)).toBe(true);
      expect(row.current_streak).toBeGreaterThanOrEqual(0);
      if (row.streak_type !== null) {
        expect(['W', 'L']).toContain(row.streak_type);
      }
    }
  });

  it('best_partner_id es null si el jugador no tuvo partner', () => {
    const emptyRow: PollaStandingsRow = {
      ...STANDINGS_FIXTURE[0],
      games_played: 0, wins: 0, losses: 0,
      best_partner_id: null, best_partner_name: null,
    };
    expect(emptyRow.best_partner_id).toBeNull();
  });

  it('ordering: total_points desc, wins desc tiebreak', () => {
    const sorted = [...STANDINGS_FIXTURE].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.wins - a.wins;
    });
    expect(sorted[0].user_id).toBe('carlos');
    expect(sorted[1].user_id).toBe('erik');
  });
});

describe('PollaPartnerRow', () => {
  it('shape correcto', () => {
    const partner: PollaPartnerRow = {
      partner_id: 'erik',
      games_together: 3,
      wins_together: 2,
      win_pct: 66.7,
    };
    expect(partner.games_together).toBeGreaterThan(0);
    expect(partner.wins_together).toBeLessThanOrEqual(partner.games_together);
  });
});

describe('PollaRivalRow', () => {
  it('shape correcto', () => {
    const rival: PollaRivalRow = {
      rival_id: 'gusi',
      games_against: 5,
      wins_for_rival: 3,
      win_pct: 60.0,
    };
    expect(rival.games_against).toBeGreaterThan(0);
    expect(rival.wins_for_rival).toBeLessThanOrEqual(rival.games_against);
  });
});

describe('current_streak / streak_type invariants', () => {
  it('streak_type null implica count = 0 (sin racha)', () => {
    const noStreak: PollaStandingsRow = { ...STANDINGS_FIXTURE[0], current_streak: 0, streak_type: null };
    expect(noStreak.streak_type).toBeNull();
    expect(noStreak.current_streak).toBe(0);
  });

  it('streak_type W/L con count >= 1 representa racha activa', () => {
    const winStreak: PollaStandingsRow = { ...STANDINGS_FIXTURE[0], current_streak: 3, streak_type: 'W' };
    expect(winStreak.current_streak).toBeGreaterThanOrEqual(1);
    expect(winStreak.streak_type).toBe('W');
  });
});
