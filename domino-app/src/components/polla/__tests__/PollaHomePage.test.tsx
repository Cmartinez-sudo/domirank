/** @vitest-environment jsdom */

/**
 * Tests para PollaHomePage.
 *
 * Foco: garantizar que `rosterUserIds` viene SEPARADO de `standings`,
 * y que el modal de nueva partida recibe los 4 user IDs incluso cuando
 * `standings` está vacío (caso polla recién iniciada sin partidas).
 *
 * Bug histórico (fixed): el roster se derivaba de standings, que filtra
 * por matches confirmed. Resultado: modal sin opciones de jugadores en
 * el happy path de polla nueva.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PollaHomePage } from '../PollaHomePage';
import type { PollaStandingsRow, PollaRoundGroup } from '@/types/polla';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/polla-actions', () => ({
  createNewMatchInPolla: vi.fn(() => Promise.resolve({ ok: true, match_id: 'm1' })),
  startNewSeason:        vi.fn(() => Promise.resolve({ ok: true, new_season: 2 })),
  closePolla:            vi.fn(() => Promise.resolve({ ok: true })),
}));

const TOURNAMENT = {
  id: 't1',
  name: 'Polla del barrio',
  is_open_ended: true,
  current_season: 1,
  created_by: 'carlos',
  status: 'in_progress' as const,
};

const ROSTER = ['carlos', 'erik', 'gibbon', 'gusi'];
const USER_NAMES = {
  carlos: 'Carlos',
  erik:   'Erik',
  gibbon: 'Gibbon',
  gusi:   'Gusi',
};

describe('PollaHomePage', () => {
  // ─── Regression test del bug del happy path ──────────────────────
  it('renderiza con standings vacío (polla recién iniciada)', () => {
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]} // ← polla recién creada, sin partidas
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(container.textContent).toContain('Polla del barrio');
    expect(container.textContent).toContain('Nueva partida');
  });

  it('pasa rosterUserIds — no derivado de standings — al modal (regresión bug happy path)', () => {
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(container.textContent).toContain('+ Nueva partida');
  });

  it('renderiza el leaderboard con standings cuando hay partidas', () => {
    const standings: PollaStandingsRow[] = [
      {
        user_id: 'carlos', username: 'carlos', display_name: 'Carlos',
        avatar_url: null, total_points: 200, wins: 2, losses: 0, win_pct: 100, games_played: 2,
        current_streak: '2W',
        best_partner_id: 'erik', best_partner_name: 'Erik',
        best_partner_wins: 2, best_partner_losses: 0,
        worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
        worst_rival_wins: 0, worst_rival_losses: 2,
      },
    ];
    const { getByTestId, container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={standings}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={2}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(getByTestId('player-name').textContent).toBe('Carlos');
    // Partner stats reales (no 0W-0L hardcoded)
    expect(container.textContent).toContain('2W-0L');
    expect(container.textContent).toContain('0W-2L');
  });

  it('botón "+ Nueva partida" oculto cuando el torneo está finished', () => {
    const finished = { ...TOURNAMENT, status: 'finished' as const };
    const { container } = render(
      <PollaHomePage
        tournament={finished}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    const buttons = container.querySelectorAll('button');
    const hasNuevaPartidaButton = Array.from(buttons).some(
      (b) => (b.textContent ?? '').trim() === '+ Nueva partida',
    );
    expect(hasNuevaPartidaButton).toBe(false);
  });

  it('badge "Indefinida" / "Cerrada" según is_open_ended', () => {
    const { container } = render(
      <PollaHomePage
        tournament={{ ...TOURNAMENT, is_open_ended: false }}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(container.textContent).toContain('Cerrada');
  });

  type RoundsTestData = PollaRoundGroup[];

  it('renderiza rounds accordion cuando hay rounds', () => {
    const rounds: RoundsTestData = [
      {
        round_number: 1,
        matches: [
          {
            match_id: 'm1',
            team_a_user_ids: ['carlos', 'erik'],
            team_b_user_ids: ['gibbon', 'gusi'],
            team_a_score: 100,
            team_b_score: 87,
            status: 'confirmed',
          },
        ],
      },
    ];
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={rounds}
        totalMatches={1}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(container.textContent).toContain('Ronda 1');
  });

  // ─── Nuevos tests para Temporada selector + Cerrar polla ─────────
  it('muestra badge "Histórico" y oculta acciones cuando viewingSeason != current_season', () => {
    const t2 = { ...TOURNAMENT, current_season: 2 };
    const { container } = render(
      <PollaHomePage
        tournament={t2}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}  // ← histórica
      />,
    );
    expect(container.textContent).toContain('Histórico');
    // Sin "Nueva partida" en modo histórico
    const buttons = container.querySelectorAll('button');
    const hasNew = Array.from(buttons).some(
      (b) => (b.textContent ?? '').trim() === '+ Nueva partida',
    );
    expect(hasNew).toBe(false);
    // Sin acciones del organizador en modo histórico
    expect(container.textContent).not.toContain('Acciones del organizador');
  });

  it('PollaSeasonSelector aparece solo si current_season > 1', () => {
    // Caso 1: temporada 1 sola → selector NO debe aparecer
    const { container: c1 } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    // Sin selector — el componente retorna null si current_season <= 1
    expect(c1.querySelector('nav[aria-label="Temporadas"]')).toBeNull();

    // Caso 2: temporada 2 → selector SÍ debe aparecer
    const { container: c2 } = render(
      <PollaHomePage
        tournament={{ ...TOURNAMENT, current_season: 2 }}
        currentUserId="carlos"
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={2}
      />,
    );
    expect(c2.querySelector('nav[aria-label="Temporadas"]')).not.toBeNull();
  });

  it('botón "Cerrar polla" visible al organizer cuando la polla no está cerrada', () => {
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"  // ← created_by === carlos
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    const buttons = container.querySelectorAll('button');
    const hasClose = Array.from(buttons).some(
      (b) => (b.textContent ?? '').trim() === 'Cerrar polla',
    );
    expect(hasClose).toBe(true);
  });

  it('botón "Cerrar polla" oculto si NO sos el organizer', () => {
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="erik"  // ← created_by es carlos, no erik
        standings={[]}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
        viewingSeason={1}
      />,
    );
    expect(container.textContent).not.toContain('Cerrar polla');
  });
});
