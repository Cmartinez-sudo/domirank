/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PollaLeaderboard } from '../PollaLeaderboard';
import type { PollaStandingsRow } from '@/types/polla';

const ROWS: PollaStandingsRow[] = [
  {
    user_id: 'a', username: 'carlos', display_name: 'Carlos',
    avatar_url: null,
    total_points: 510, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '2W',
    best_partner_id: 'b', best_partner_name: 'Erik',
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
  },
  {
    user_id: 'b', username: 'erik', display_name: 'Erik',
    avatar_url: null,
    total_points: 480, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '1L',
    best_partner_id: 'a', best_partner_name: 'Carlos',
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
  },
];

describe('PollaLeaderboard', () => {
  it('renderiza los jugadores en orden de standings', () => {
    const { container } = render(<PollaLeaderboard rows={ROWS} currentUserId="a" />);
    const names = Array.from(container.querySelectorAll('[data-testid="player-name"]'))
      .map((el) => el.textContent);
    expect(names).toEqual(['Carlos', 'Erik']);
  });

  it('highlight del jugador actual', () => {
    const { container } = render(<PollaLeaderboard rows={ROWS} currentUserId="a" />);
    const carlosRow = container.querySelector('[data-user-id="a"]');
    expect(carlosRow?.className).toContain('bg-primary/10');
  });

  it('empty state cuando no hay rows', () => {
    const { getByText } = render(<PollaLeaderboard rows={[]} currentUserId="a" />);
    expect(getByText(/sin partidas todavía/i)).toBeTruthy();
  });
});
