/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NewMatchInPollaModal } from '../NewMatchInPollaModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/polla-actions', () => ({
  createNewMatchInPolla: vi.fn(() => Promise.resolve({ ok: true, match_id: 'm1' })),
}));

const ROSTER = ['carlos', 'erik', 'gibbon', 'gusi'];
const NAMES = { carlos: 'Carlos', erik: 'Erik', gibbon: 'Gibbon', gusi: 'Gusi' };

describe('NewMatchInPollaModal', () => {
  it('renderiza los 4 players del roster', () => {
    const { getAllByText } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    // Cada nombre aparece en cada select dropdown — verificamos que al menos
    // un Carlos/Erik/Gibbon/Gusi sea visible.
    expect(getAllByText(/Carlos/).length).toBeGreaterThan(0);
    expect(getAllByText(/Erik/).length).toBeGreaterThan(0);
    expect(getAllByText(/Gibbon/).length).toBeGreaterThan(0);
    expect(getAllByText(/Gusi/).length).toBeGreaterThan(0);
  });

  it('botón empezar deshabilitado hasta tener 2 players por team', () => {
    const { getAllByRole } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    const btns = getAllByRole('button', { name: /empezar/i });
    expect(btns.length).toBeGreaterThan(0);
    expect(btns[0].hasAttribute('disabled')).toBe(true);
  });

  // ─── Regression: bug del happy path (polla nueva sin partidas) ──────
  // El roster venía de polla_standings RPC que filtra por
  // status='confirmed'. En una polla recién iniciada (sin partidas),
  // standings = [] y los dropdowns quedaban vacíos. Fix: pasar rosterUserIds
  // explícito desde tournament_players. Estos tests garantizan que no recurra.

  it('renderiza los 4 user IDs como <option> en cada <select>', () => {
    const { container } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(4); // a1, a2, b1, b2

    for (const select of Array.from(selects)) {
      // Cada select tiene: 1 placeholder "— Elegir —" + 4 jugadores del roster
      const options = select.querySelectorAll('option');
      expect(options.length).toBe(5);
      // Verificar que los 4 user IDs aparecen como value en las options
      const values = Array.from(options).map((o) => (o as HTMLOptionElement).value);
      for (const uid of ROSTER) {
        expect(values).toContain(uid);
      }
    }
  });

  it('muestra el display_name en lugar del user_id en las opciones', () => {
    const { container } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    const firstSelect = container.querySelector('select');
    expect(firstSelect).toBeTruthy();
    const optionTexts = Array.from(firstSelect!.querySelectorAll('option'))
      .map((o) => o.textContent ?? '');
    // Los nombres del map NAMES deben aparecer
    for (const name of Object.values(NAMES)) {
      const matched = optionTexts.some((t) => t.includes(name));
      expect(matched).toBe(true);
    }
  });

  it('rosterUserIds vacío (caso degradado): selects solo tienen "— Elegir —"', () => {
    // Sanity check: si por algún motivo roster viene vacío, los selects
    // muestran solo el placeholder, sin crashear.
    const { container } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={[]} userNames={{}}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    const selects = container.querySelectorAll('select');
    for (const select of Array.from(selects)) {
      const options = select.querySelectorAll('option');
      // Solo el placeholder
      expect(options.length).toBe(1);
      expect(options[0].textContent).toContain('Elegir');
    }
  });
});
