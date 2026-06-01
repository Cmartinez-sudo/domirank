/** @vitest-environment jsdom */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ContinuousLeagueHomePage } from '../ContinuousLeagueHomePage';
import type { ContinuousLeagueStandingsRow, ContinuousLeagueMatchRow } from '@/types/continuous-league';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/continuous-league-actions', () => ({
  createNewMatchInContinuousLeague: vi.fn(() => Promise.resolve({ ok: true, match_id: 'm1' })),
  startNewSeason:        vi.fn(() => Promise.resolve({ ok: true, new_season: 2 })),
  closeContinuousLeague:            vi.fn(() => Promise.resolve({ ok: true })),
}));

const TOURNAMENT = {
  id:             't1',
  name:           'Polla del barrio',
  is_open_ended:  true,
  current_season: 1,
  created_by:     'carlos',
  status:         'in_progress' as const,
  total_rounds:   null,
  created_at:     '2026-05-20T10:00:00Z',
};

const DEFAULT_LEADERBOARD_PROPS = {
  dayFilter:  'all' as const,
  todayCount: 0,
  allCount:   0,
};

const ROSTER = ['carlos', 'erik', 'gibbon', 'gusi'];
const USER_NAMES = {
  carlos: 'Carlos',
  erik:   'Erik',
  gibbon: 'Gibbon',
  gusi:   'Gusi',
};

function row(uid: string, name: string, overrides: Partial<ContinuousLeagueStandingsRow> = {}): ContinuousLeagueStandingsRow {
  return {
    user_id: uid, username: uid, display_name: name,
    avatar_url: null, total_points: 0,
    points_for: 0, points_against: 0, diff: 0,
    wins: 0, losses: 0, win_pct: 0, games_played: 0,
    current_streak: 0, streak_type: null,
    best_partner_id: null, best_partner_name: null, best_partner_wins: 0, best_partner_losses: 0,
    worst_rival_id: null, worst_rival_name: null, worst_rival_wins: 0, worst_rival_losses: 0,
    ...overrides,
  };
}

describe('ContinuousLeagueHomePage', () => {
  it('renderiza con standings vacío (polla recién iniciada)', () => {
    const { container } = render(
      <ContinuousLeagueHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        matches={[]}
        activeMatch={null}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0}
      />,
    );
    expect(container.textContent).toContain('Polla del barrio');
    // El bigbtn de "Jugar nueva partida" debe aparecer
    expect(container.textContent).toContain('Jugar nueva partida');
  });

  it('big button muestra "Continuar partida en curso" con score live', () => {
    const activeMatch: ContinuousLeagueMatchRow = {
      match_id: 'm-live',
      status: 'in_progress',
      team_a_user_ids: ['carlos', 'erik'],
      team_b_user_ids: ['gibbon', 'gusi'],
      score_a: 67,
      score_b: 42,
      winner_team: null,
      created_at: new Date().toISOString(),
    };
    const { container } = render(
      <ContinuousLeagueHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        matches={[activeMatch]}
        activeMatch={activeMatch}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0}
      />,
    );
    expect(container.textContent).toContain('Continuar partida en curso');
    expect(container.textContent).toContain('Carlos & Erik');
    expect(container.textContent).toContain('67');
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('Gibbon & Gusi');
  });

  it('badge "Continua" / "Cerrada" según is_open_ended', () => {
    const { container: c1 } = render(
      <ContinuousLeagueHomePage tournament={TOURNAMENT} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(c1.textContent).toContain('Continua');

    const { container: c2 } = render(
      <ContinuousLeagueHomePage tournament={{ ...TOURNAMENT, is_open_ended: false }} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(c2.textContent).toContain('Cerrada');
  });

  it('matches list muestra todas las partidas con scores', () => {
    const matches: ContinuousLeagueMatchRow[] = [
      {
        match_id: 'm1', status: 'confirmed',
        team_a_user_ids: ['carlos', 'erik'], team_b_user_ids: ['gibbon', 'gusi'],
        score_a: 100, score_b: 87, winner_team: 1,
        created_at: '2026-05-28T10:00:00Z',
      },
    ];
    const { container } = render(
      <ContinuousLeagueHomePage tournament={TOURNAMENT} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={matches} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(container.textContent).toContain('Partidas (1)');
    expect(container.textContent).toContain('100');
    expect(container.textContent).toContain('87');
  });

  it('Champion card aparece solo si la polla está finished', () => {
    const standings = [row('carlos', 'Carlos', { total_points: 510, wins: 7, losses: 3 })];
    const finished = { ...TOURNAMENT, status: 'finished' as const };
    const { container } = render(
      <ContinuousLeagueHomePage tournament={finished} currentUserId="carlos" standings={standings} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(container.textContent).toContain('Campeón');
    expect(container.textContent).toContain('Carlos');
    expect(container.textContent).toContain('510 puntos · 7V-3D');
    // Sin big button cuando ya terminó (el texto aparece en el empty state copy del matches list,
    // pero no debe haber un button con ese texto como heading principal).
    const buttons = Array.from(container.querySelectorAll('button'));
    const hasStartBtn = buttons.some((b) => {
      const heading = b.querySelector('div.font-semibold');
      return heading?.textContent === 'Jugar nueva partida';
    });
    expect(hasStartBtn).toBe(false);
  });

  it('modo histórico oculta el big button y las acciones del organizador', () => {
    const t2 = { ...TOURNAMENT, current_season: 2 };
    const { container } = render(
      <ContinuousLeagueHomePage tournament={t2} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(container.textContent).toContain('Histórico');
    // Sin big button en modo histórico (el texto "Jugar nueva partida" puede aparecer
    // en el empty state copy del matches list, pero NO debe haber un botón con esa heading).
    const buttons = Array.from(container.querySelectorAll('button'));
    const hasStartBtn = buttons.some((b) => {
      const heading = b.querySelector('div.font-semibold');
      return heading?.textContent === 'Jugar nueva partida';
    });
    expect(hasStartBtn).toBe(false);
    expect(container.textContent).not.toContain('Nueva temporada');
  });

  it('botón "Cerrar polla" visible al organizer en polla continua', () => {
    const { container } = render(
      <ContinuousLeagueHomePage tournament={TOURNAMENT} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    const buttons = container.querySelectorAll('button');
    const hasClose = Array.from(buttons).some((b) => (b.textContent ?? '').includes('Cerrar polla'));
    expect(hasClose).toBe(true);
  });

  it('botón dice "Finalizar polla" cuando is_open_ended=false', () => {
    const closed = { ...TOURNAMENT, is_open_ended: false };
    const { container } = render(
      <ContinuousLeagueHomePage tournament={closed} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    const buttons = container.querySelectorAll('button');
    const hasFinalize = Array.from(buttons).some((b) => (b.textContent ?? '').includes('Finalizar polla'));
    expect(hasFinalize).toBe(true);
  });

  it('acciones del organizador ocultas para no-organizers', () => {
    const { container } = render(
      <ContinuousLeagueHomePage tournament={TOURNAMENT} currentUserId="erik" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(container.textContent).not.toContain('Cerrar polla');
    expect(container.textContent).not.toContain('Nueva temporada');
  });

  it('ContinuousLeagueSeasonSelector aparece solo si current_season > 1', () => {
    const { container: c1 } = render(
      <ContinuousLeagueHomePage tournament={TOURNAMENT} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={1}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(c1.querySelector('nav[aria-label="Temporadas"]')).toBeNull();

    const { container: c2 } = render(
      <ContinuousLeagueHomePage tournament={{ ...TOURNAMENT, current_season: 2 }} currentUserId="carlos" standings={[]} rosterUserIds={ROSTER}
        matches={[]} activeMatch={null} playerCount={4} userNames={USER_NAMES} viewingSeason={2}
        dayFilter="all" todayCount={0} allCount={0} />,
    );
    expect(c2.querySelector('nav[aria-label="Temporadas"]')).not.toBeNull();
  });
});
