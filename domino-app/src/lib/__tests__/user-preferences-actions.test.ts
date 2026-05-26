/**
 * Unit tests para user-preferences-actions (server action).
 *
 * Decisión de testing: Opción A.
 * El schema Zod se testea en user-preferences-schema.test.ts importando el
 * módulo puro (sin "use server"). Aquí mockeamos supabaseServer y ratelimit
 * para verificar que el server action llama upsert con los datos correctos
 * y devuelve { ok: true, data }.
 *
 * Nota: vi.mock hoisting requiere que la factory sea una arrow function pura
 * (no puede usar variables externas). Usamos vi.fn() y reasignamos en beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/ratelimit', () => ({
  rl: { preferences: null },
  checkLimit: vi.fn(async () => ({ allowed: true })),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { updateUserPreferences } from '../user-preferences-actions';

// ── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

const FAKE_PREFERENCES = {
  user_id: FAKE_USER_ID,
  default_match_modality: 'ven',
  skip_modality_prompt: true,
  notification_settings: {},
  theme: 'dark',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('updateUserPreferences (server action)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: FAKE_USER_ID } } });
    mockSingle.mockResolvedValue({ data: FAKE_PREFERENCES, error: null });
  });

  it('llama upsert con user_id y datos validados, devuelve { ok: true, data }', async () => {
    const input = { default_match_modality: 'ven' as const, skip_modality_prompt: true };
    const result = await updateUserPreferences(input);

    expect(mockFrom).toHaveBeenCalledWith('user_preferences');
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: FAKE_USER_ID, default_match_modality: 'ven', skip_modality_prompt: true },
      { onConflict: 'user_id' },
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(FAKE_PREFERENCES);
  });

  it('devuelve { ok: false, error } cuando el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await updateUserPreferences({ theme: 'dark' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('No autenticado');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('devuelve { ok: false, error } cuando el input falla validación zod', async () => {
    // @ts-expect-error — a propósito para testear validación en runtime
    const result = await updateUserPreferences({ theme: 'pink' });

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('devuelve { ok: false, error } cuando la DB devuelve error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB connection lost' } });

    const result = await updateUserPreferences({ theme: 'light' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('DB connection lost');
  });
});
