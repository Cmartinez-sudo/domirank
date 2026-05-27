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
});
