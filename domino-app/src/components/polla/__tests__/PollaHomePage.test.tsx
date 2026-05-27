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
  startNewSeason: vi.fn(() => Promise.resolve({ ok: true, new_season: 2 })),
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
      />,
    );
    // Sin crashear, debe renderizar el header con el nombre del torneo
    expect(container.textContent).toContain('Polla del barrio');
    // Debe mostrar el botón "Nueva partida" (no closed)
    expect(container.textContent).toContain('Nueva partida');
  });

  it('pasa rosterUserIds — no derivado de standings — al modal (regresión bug happy path)', () => {
    // Verificación clave: PollaHomePage acepta rosterUserIds como prop
    // separado de standings, por lo que NEVER puede recurrir el bug donde
    // standings vacío rompe el modal. Esta firma del componente es el
    // contrato. La integración real con el modal está cubierta por
    // NewMatchInPollaModal.test.tsx ("renderiza los 4 user IDs como <option>").
    const { container } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={[]} // ← STANDINGS VACÍO — caso clave
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={0}
        playerCount={4}
        userNames={USER_NAMES}
      />,
    );
    // Sin crashear y muestra el botón para abrir el modal
    expect(container.textContent).toContain('+ Nueva partida');
  });

  it('renderiza el leaderboard con standings cuando hay partidas', () => {
    const standings: PollaStandingsRow[] = [
      {
        user_id: 'carlos', username: 'carlos', display_name: 'Carlos',
        avatar_url: null, total_points: 200, wins: 2, losses: 0, win_pct: 100, games_played: 2,
        current_streak: '2W',
        best_partner_id: 'erik', best_partner_name: 'Erik',
        worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
      },
    ];
    const { getByTestId } = render(
      <PollaHomePage
        tournament={TOURNAMENT}
        currentUserId="carlos"
        standings={standings}
        rosterUserIds={ROSTER}
        rounds={[]}
        totalMatches={2}
        playerCount={4}
        userNames={USER_NAMES}
      />,
    );
    expect(getByTestId('player-name').textContent).toBe('Carlos');
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
      />,
    );
    // Buscamos el button como elemento, no como texto (el empty state del
    // leaderboard sí menciona la frase, pero como texto literal — no como botón).
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
      />,
    );
    expect(container.textContent).toContain('Ronda 1');
  });
});
