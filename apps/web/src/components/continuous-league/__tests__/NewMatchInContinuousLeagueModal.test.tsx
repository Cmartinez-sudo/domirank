/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { NewMatchInContinuousLeagueModal } from '../NewMatchInContinuousLeagueModal';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const createMatchMock = vi.fn((_input: unknown) => Promise.resolve({ ok: true, match_id: 'm1' }));
vi.mock('@/lib/continuous-league-actions', () => ({
  createNewMatchInContinuousLeague: (input: unknown) => createMatchMock(input),
}));

const ROSTER = ['carlos', 'erik', 'gibbon', 'gusi'];
const NAMES = { carlos: 'Carlos', erik: 'Erik', gibbon: 'Gibbon', gusi: 'Gusi' };

function defaultProps(overrides: Partial<React.ComponentProps<typeof NewMatchInContinuousLeagueModal>> = {}) {
  return {
    tournamentId: 't1',
    rosterUserIds: ROSTER,
    userNames: NAMES,
    currentUserId: 'carlos',
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  pushMock.mockClear();
  createMatchMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('NewMatchInContinuousLeagueModal · Step 1 selección', () => {
  it('renderiza los 4 nombres del roster como botones tappable', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    const buttons = Array.from(container.querySelectorAll('button[aria-pressed]'));
    expect(buttons.length).toBe(4);
    const labels = buttons.map((b) => b.textContent ?? '');
    for (const name of Object.values(NAMES)) {
      expect(labels.some((l) => l.includes(name))).toBe(true);
    }
  });

  it('currentUserId aparece pre-seleccionado al abrir', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    const carlosBtn = Array.from(container.querySelectorAll('button[aria-pressed]'))
      .find((b) => (b.textContent ?? '').includes('Carlos'));
    expect(carlosBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('contador X/4 refleja la selección', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    expect(container.textContent).toContain('1/4');
  });

  it('rosterUserIds vacío no crashea', () => {
    const { container } = render(
      <NewMatchInContinuousLeagueModal {...defaultProps({ rosterUserIds: [], userNames: {}, currentUserId: 'x' })} />,
    );
    // Sin botones de jugador pero sin error
    const playerBtns = container.querySelectorAll('button[aria-pressed]');
    expect(playerBtns.length).toBe(0);
    expect(container.textContent).toContain('Paso 1');
  });
});

describe('NewMatchInContinuousLeagueModal · Step 2 parejas', () => {
  it('Step 2 NO aparece hasta tener 4 jugadores seleccionados', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    expect(container.textContent).not.toContain('Paso 2');
  });

  it('al seleccionar 4 → Step 2 aparece y armó parejas en modo aleatorio', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    // Tap los 3 restantes (carlos ya está)
    const playerBtns = Array.from(container.querySelectorAll('button[aria-pressed]'));
    const others = playerBtns.filter((b) => !(b.textContent ?? '').includes('Carlos'));
    for (const b of others) fireEvent.click(b);

    expect(container.textContent).toContain('Paso 2');
    expect(container.textContent).toContain('Aleatorio');
    expect(container.textContent).toContain('Pareja A');
    expect(container.textContent).toContain('Pareja B');
    // En modo random las 2/2 deben estar pobladas
    expect(container.textContent).toContain('2/2');
  });

  it('botón "Comenzar" deshabilitado mientras no haya 2v2', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    const startBtn = container.querySelector('button.btn-primary') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);

    // Seleccionar los otros 3 → modo random arma teams → botón habilitado
    const playerBtns = Array.from(container.querySelectorAll('button[aria-pressed]'));
    const others = playerBtns.filter((b) => !(b.textContent ?? '').includes('Carlos'));
    for (const b of others) fireEvent.click(b);

    expect(startBtn.disabled).toBe(false);
  });

  it('modo Manual aparece como opción del segment', () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    // Llegar a 4
    const playerBtns = Array.from(container.querySelectorAll('button[aria-pressed]'));
    const others = playerBtns.filter((b) => !(b.textContent ?? '').includes('Carlos'));
    for (const b of others) fireEvent.click(b);

    expect(container.textContent).toContain('Aleatorio');
    expect(container.textContent).toContain('Manual');
  });
});

describe('NewMatchInContinuousLeagueModal · submit', () => {
  it('Comenzar llama createNewMatchInContinuousLeague y redirige al /live', async () => {
    const { container } = render(<NewMatchInContinuousLeagueModal {...defaultProps()} />);
    const playerBtns = Array.from(container.querySelectorAll('button[aria-pressed]'));
    const others = playerBtns.filter((b) => !(b.textContent ?? '').includes('Carlos'));
    for (const b of others) fireEvent.click(b);

    const startBtn = container.querySelector('button.btn-primary') as HTMLButtonElement;
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(createMatchMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/matches/m1/live');
    });
  });
});
