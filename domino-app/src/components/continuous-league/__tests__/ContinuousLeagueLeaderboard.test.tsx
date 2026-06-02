/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ContinuousLeagueLeaderboard } from '../ContinuousLeagueLeaderboard';
import type { ContinuousLeagueStandingsRow } from '@/types/continuous-league';

const ROWS: ContinuousLeagueStandingsRow[] = [
  {
    user_id: 'a', username: 'carlos', display_name: 'Carlos',
    avatar_url: null,
    total_points: 510, points_for: 510, points_against: 420, diff: 90,
    wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: 2, streak_type: 'W',
    best_partner_id: 'b', best_partner_name: 'Erik',
    best_partner_wins: 2, best_partner_losses: 1,
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
    worst_rival_wins: 2, worst_rival_losses: 3,
  },
  {
    user_id: 'b', username: 'erik', display_name: 'Erik',
    avatar_url: null,
    total_points: 480, points_for: 480, points_against: 450, diff: 30,
    wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: 1, streak_type: 'L',
    best_partner_id: 'a', best_partner_name: 'Carlos',
    best_partner_wins: 2, best_partner_losses: 1,
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
    worst_rival_wins: 2, worst_rival_losses: 3,
  },
];

describe('ContinuousLeagueLeaderboard', () => {
  it('renderiza los jugadores en orden de standings', () => {
    const { container } = render(<ContinuousLeagueLeaderboard rows={ROWS} currentUserId="a" />);
    const names = Array.from(container.querySelectorAll('[data-testid="player-name"]'))
      .map((el) => el.textContent);
    expect(names).toEqual(['Carlos', 'Erik']);
  });

  it('highlight del jugador actual', () => {
    const { container } = render(<ContinuousLeagueLeaderboard rows={ROWS} currentUserId="a" />);
    const carlosRow = container.querySelector('tr[data-user-id="a"]');
    expect(carlosRow?.className).toContain('bg-primary/5');
  });

  it('chip de racha colorea W primary, L danger', () => {
    const { container } = render(<ContinuousLeagueLeaderboard rows={ROWS} currentUserId="a" />);
    expect(container.textContent).toContain('2W');
    expect(container.textContent).toContain('1L');
  });

  it('columnas PF/PC/± renderizan los valores', () => {
    const { container } = render(<ContinuousLeagueLeaderboard rows={ROWS} currentUserId="a" />);
    expect(container.textContent).toContain('510');   // PF de Carlos
    expect(container.textContent).toContain('420');   // PC de Carlos
    expect(container.textContent).toContain('+90');   // ± de Carlos
  });

  it('ya NO renderiza tabs internamente (movidas a LeaderboardTabs)', () => {
    const { container } = render(<ContinuousLeagueLeaderboard rows={ROWS} currentUserId="a" />);
    expect(container.querySelector('[role="tab"]')).toBeNull();
  });

  it('empty state cuando ningún jugador ha jugado', () => {
    const empty = ROWS.map((r) => ({ ...r, games_played: 0 }));
    const { container } = render(<ContinuousLeagueLeaderboard rows={empty} currentUserId="a" />);
    expect(container.textContent).toContain('Aún no hay partidas jugadas');
  });
});
