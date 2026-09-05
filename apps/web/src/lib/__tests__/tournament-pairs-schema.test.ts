import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-testeamos la lógica pura del schema de pares (sin servidor)
const UUID_A = '00000000-0000-0000-0000-000000000001';
const UUID_B = '00000000-0000-0000-0000-000000000002';
const UUID_C = '00000000-0000-0000-0000-000000000003';
const UUID_D = '00000000-0000-0000-0000-000000000004';

// Replica del schema interno de setTournamentPairs para testear la lógica
const pairsSchema = z.array(
  z.object({ user_a: z.string().uuid(), user_b: z.string().uuid() }),
);

/** Canonical order helper (mismo que en production) */
function canonicalPair(a: string, b: string) {
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}

describe('canonicalPair — orden canónico de UUIDs', () => {
  it('user_a < user_b: no cambia el orden', () => {
    expect(canonicalPair(UUID_A, UUID_B)).toEqual({ user_a_id: UUID_A, user_b_id: UUID_B });
  });

  it('user_a > user_b: invierte el orden', () => {
    expect(canonicalPair(UUID_B, UUID_A)).toEqual({ user_a_id: UUID_A, user_b_id: UUID_B });
  });

  it('resultado es idempotente: mismo output independientemente del input order', () => {
    const r1 = canonicalPair(UUID_C, UUID_D);
    const r2 = canonicalPair(UUID_D, UUID_C);
    expect(r1).toEqual(r2);
  });

  it('user_a_id es siempre el lexicográficamente menor', () => {
    const r = canonicalPair(UUID_B, UUID_A);
    expect(r.user_a_id < r.user_b_id).toBe(true);
  });
});

describe('pairsSchema — validación de array de parejas', () => {
  it('acepta array vacío', () => {
    expect(pairsSchema.safeParse([]).success).toBe(true);
  });

  it('acepta parejas válidas', () => {
    const input = [
      { user_a: UUID_A, user_b: UUID_B },
      { user_a: UUID_C, user_b: UUID_D },
    ];
    expect(pairsSchema.safeParse(input).success).toBe(true);
  });

  it('rechaza UUIDs malformados', () => {
    const input = [{ user_a: 'not-uuid', user_b: UUID_B }];
    expect(pairsSchema.safeParse(input).success).toBe(false);
  });

  it('rechaza si falta user_b', () => {
    const input = [{ user_a: UUID_A }];
    expect(pairsSchema.safeParse(input).success).toBe(false);
  });

  it('rechaza si el array contiene null', () => {
    expect(pairsSchema.safeParse([null]).success).toBe(false);
  });
});

describe('lógica de validación de duplicados (unit pura)', () => {
  function checkNoDuplicates(pairs: Array<{ user_a: string; user_b: string }>) {
    const allIds = pairs.flatMap(({ user_a, user_b }) => [user_a, user_b]);
    return new Set(allIds).size === allIds.length;
  }

  function checkNoSelf(pairs: Array<{ user_a: string; user_b: string }>) {
    return pairs.every(({ user_a, user_b }) => user_a !== user_b);
  }

  it('parejas sin duplicados: OK', () => {
    const pairs = [
      { user_a: UUID_A, user_b: UUID_B },
      { user_a: UUID_C, user_b: UUID_D },
    ];
    expect(checkNoDuplicates(pairs)).toBe(true);
    expect(checkNoSelf(pairs)).toBe(true);
  });

  it('jugador en dos parejas: detectado como duplicado', () => {
    const pairs = [
      { user_a: UUID_A, user_b: UUID_B },
      { user_a: UUID_A, user_b: UUID_C }, // A aparece dos veces
    ];
    expect(checkNoDuplicates(pairs)).toBe(false);
  });

  it('pareja con mismo user dos veces: detectado como self', () => {
    const pairs = [{ user_a: UUID_A, user_b: UUID_A }];
    expect(checkNoSelf(pairs)).toBe(false);
  });
});

describe('pair_invites — validaciones de negocio (unit)', () => {
  // Prueba la lógica de verificación del respondPairInvite sin hits a DB
  type InviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

  function canRespond(invite: { status: InviteStatus; invitee_id: string }, userId: string): boolean {
    return invite.invitee_id === userId && invite.status === 'pending';
  }

  it('invitee puede responder cuando status = pending', () => {
    const invite = { status: 'pending' as InviteStatus, invitee_id: UUID_A };
    expect(canRespond(invite, UUID_A)).toBe(true);
  });

  it('invitee no puede responder si status != pending', () => {
    for (const status of ['accepted', 'declined', 'cancelled'] as InviteStatus[]) {
      expect(canRespond({ status, invitee_id: UUID_A }, UUID_A)).toBe(false);
    }
  });

  it('otra persona no puede responder la invitación', () => {
    const invite = { status: 'pending' as InviteStatus, invitee_id: UUID_A };
    expect(canRespond(invite, UUID_B)).toBe(false);
  });
});
