import { describe, it, expect } from 'vitest';
import { createTournamentSchema } from '../tournament-schema';

// UUIDs de ejemplo para los tests
const UUID_A = '00000000-0000-0000-0000-000000000001';
const UUID_B = '00000000-0000-0000-0000-000000000002';
const UUID_C = '00000000-0000-0000-0000-000000000003';

const VALID_BASE = {
  name: 'Polla del barrio Mayo 2026',
  visibility: 'public' as const,
  format: 'swiss' as const,
  modality: 'ven' as const,
  max_players: 8,
  inscription_mode: 'pre_formed' as const,
  time_limit_minutes: 30,
};

describe('createTournamentSchema', () => {
  // ── Nombre ─────────────────────────────────────────────────
  it('acepta nombre de 3 a 60 caracteres', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, name: 'ABC' }).success).toBe(true);
    const long60 = 'A'.repeat(60);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, name: long60 }).success).toBe(true);
  });

  it('rechaza nombre de 2 caracteres', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, name: 'AB' }).success).toBe(false);
  });

  it('rechaza nombre de 61 caracteres', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, name: 'A'.repeat(61) }).success).toBe(false);
  });

  // ── Visibilidad ────────────────────────────────────────────
  it('acepta visibility: public | private | code', () => {
    for (const v of ['public', 'private', 'code'] as const) {
      expect(createTournamentSchema.safeParse({ ...VALID_BASE, visibility: v }).success).toBe(true);
    }
  });

  it('rechaza visibility: friends (renombrado a code en el EPIC)', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, visibility: 'friends' }).success).toBe(false);
  });

  // ── Formato ────────────────────────────────────────────────
  it('acepta los 3 formatos válidos', () => {
    for (const f of ['single_elim', 'round_robin', 'swiss'] as const) {
      expect(createTournamentSchema.safeParse({ ...VALID_BASE, format: f }).success).toBe(true);
    }
  });

  it('rechaza formatos deferred (rotation, double_elim, points_league)', () => {
    for (const f of ['rotation', 'double_elim', 'points_league']) {
      expect(createTournamentSchema.safeParse({ ...VALID_BASE, format: f }).success).toBe(false);
    }
  });

  // ── Modalidad ──────────────────────────────────────────────
  it('acepta modalidades válidas', () => {
    for (const m of ['ven', 'dom', 'cub', 'pri', 'custom'] as const) {
      expect(createTournamentSchema.safeParse({ ...VALID_BASE, modality: m }).success).toBe(true);
    }
  });

  // ── max_players ────────────────────────────────────────────
  it('acepta max_players 4-64', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, max_players: 4 }).success).toBe(true);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, max_players: 64 }).success).toBe(true);
  });

  it('rechaza max_players fuera del rango', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, max_players: 3 }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, max_players: 65 }).success).toBe(false);
  });

  // ── inscription_mode ───────────────────────────────────────
  it('acepta pre_formed e individual_manual', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, inscription_mode: 'pre_formed' }).success).toBe(true);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, inscription_mode: 'individual_manual' }).success).toBe(true);
  });

  it('rechaza mexicano (deferred)', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, inscription_mode: 'mexicano' }).success).toBe(false);
  });

  // ── time_limit_minutes ─────────────────────────────────────
  it('acepta time_limit_minutes null', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, time_limit_minutes: null }).success).toBe(true);
  });

  it('acepta time_limit_minutes en rango 5-180', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, time_limit_minutes: 5 }).success).toBe(true);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, time_limit_minutes: 180 }).success).toBe(true);
  });

  it('rechaza time_limit_minutes < 5', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, time_limit_minutes: 4 }).success).toBe(false);
  });

  it('rechaza time_limit_minutes > 180', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, time_limit_minutes: 181 }).success).toBe(false);
  });

  // ── pre_formed_pairs ───────────────────────────────────────
  it('acepta pre_formed_pairs con UUIDs válidos', () => {
    const input = {
      ...VALID_BASE,
      pre_formed_pairs: [{ user_a: UUID_A, user_b: UUID_B }],
    };
    expect(createTournamentSchema.safeParse(input).success).toBe(true);
  });

  it('rechaza pre_formed_pairs con UUIDs inválidos', () => {
    const input = {
      ...VALID_BASE,
      pre_formed_pairs: [{ user_a: 'not-a-uuid', user_b: UUID_B }],
    };
    expect(createTournamentSchema.safeParse(input).success).toBe(false);
  });

  // ── participant_ids ────────────────────────────────────────
  it('acepta participant_ids vacío', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, participant_ids: [] }).success).toBe(true);
  });

  it('rechaza participant_ids con string inválido', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, participant_ids: ['not-uuid'] }).success).toBe(false);
  });

  // ── description ────────────────────────────────────────────
  it('acepta description de hasta 500 caracteres', () => {
    expect(
      createTournamentSchema.safeParse({ ...VALID_BASE, description: 'A'.repeat(500) }).success,
    ).toBe(true);
  });

  it('rechaza description de más de 500 caracteres', () => {
    expect(
      createTournamentSchema.safeParse({ ...VALID_BASE, description: 'A'.repeat(501) }).success,
    ).toBe(false);
  });

  // ── join_code ──────────────────────────────────────────────
  it('acepta join_code de exactamente 6 caracteres', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, join_code: 'ABC123' }).success).toBe(true);
  });

  it('rechaza join_code de 5 o 7 caracteres', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, join_code: 'AB123' }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, join_code: 'ABC1234' }).success).toBe(false);
  });

  // ── custom_goal ────────────────────────────────────────────
  it('acepta custom_goal 50-500 cuando modality=custom', () => {
    const input = { ...VALID_BASE, modality: 'custom' as const, custom_goal: 150 };
    expect(createTournamentSchema.safeParse(input).success).toBe(true);
  });

  it('rechaza custom_goal < 50', () => {
    const input = { ...VALID_BASE, modality: 'custom' as const, custom_goal: 49 };
    expect(createTournamentSchema.safeParse(input).success).toBe(false);
  });

  it('custom_capicua acepta rango 10-100', () => {
    const input = { ...VALID_BASE, modality: 'custom' as const, custom_capicua: 25 };
    expect(createTournamentSchema.safeParse(input).success).toBe(true);
  });

  it('custom_capicua rechaza > 100', () => {
    const input = { ...VALID_BASE, modality: 'custom' as const, custom_capicua: 101 };
    expect(createTournamentSchema.safeParse(input).success).toBe(false);
  });

  // ── rated ──────────────────────────────────────────────────
  it('rated default true cuando no se pasa', () => {
    const parsed = createTournamentSchema.safeParse(VALID_BASE);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.rated).toBe(true);
  });

  it('acepta rated=false (torneo amistoso)', () => {
    const parsed = createTournamentSchema.safeParse({ ...VALID_BASE, rated: false });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.rated).toBe(false);
  });

  it('rechaza rated no-boolean', () => {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, rated: 'yes' }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, rated: 1 }).success).toBe(false);
  });

  // ── input completo válido ──────────────────────────────────
  it('valida un input completo realista', () => {
    const full = {
      name: 'Copa Venezuela 2026',
      visibility: 'code' as const,
      format: 'swiss' as const,
      modality: 'ven' as const,
      max_players: 16,
      inscription_mode: 'pre_formed' as const,
      time_limit_minutes: 30,
      description: 'Torneo de prueba',
      join_code: 'VEN001',
      participant_ids: [UUID_A],
      pre_formed_pairs: [{ user_a: UUID_A, user_b: UUID_B }],
    };
    const result = createTournamentSchema.safeParse(full);
    expect(result.success).toBe(true);
  });
});
