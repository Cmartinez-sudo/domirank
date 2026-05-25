import { describe, it, expect } from 'vitest';
import { resolveHeroCta } from '../hero-next-match-logic';

const TOURNAMENT_ID = 'tournament-uuid-1234';
const PAIRING_ID    = 'pairing-uuid-5678';
const MATCH_ID      = 'match-uuid-9012';

describe('resolveHeroCta', () => {
  it('returns "Empezar partida" when there is no match yet', () => {
    const cta = resolveHeroCta(
      {
        id: PAIRING_ID,
        round: 1,
        team_a_user_ids: [],
        team_b_user_ids: [],
        match_id: null,
        match: null,
      },
      TOURNAMENT_ID,
    );
    expect(cta.label).toBe('Empezar partida');
    expect(cta.href).toContain(TOURNAMENT_ID);
    expect(cta.href).toContain(PAIRING_ID);
    expect(cta.variant).toBe('primary');
  });

  it('returns "Continuar partida" → /live when match is in_progress', () => {
    const cta = resolveHeroCta(
      {
        id: PAIRING_ID,
        round: 2,
        team_a_user_ids: [],
        team_b_user_ids: [],
        match_id: MATCH_ID,
        match: { id: MATCH_ID, status: 'in_progress' },
      },
      TOURNAMENT_ID,
    );
    expect(cta.label).toBe('Continuar partida');
    expect(cta.href).toBe(`/matches/${MATCH_ID}/live`);
    expect(cta.variant).toBe('primary');
  });

  it('returns "Confirmar resultado" → #attest when match is pending_attestation', () => {
    const cta = resolveHeroCta(
      {
        id: PAIRING_ID,
        round: 2,
        team_a_user_ids: [],
        team_b_user_ids: [],
        match_id: MATCH_ID,
        match: { id: MATCH_ID, status: 'pending_attestation' },
      },
      TOURNAMENT_ID,
    );
    expect(cta.label).toBe('Confirmar resultado');
    expect(cta.href).toContain('#attest');
    expect(cta.variant).toBe('secondary');
  });

  it('returns "Ver partida" as fallback for other statuses', () => {
    const cta = resolveHeroCta(
      {
        id: PAIRING_ID,
        round: 3,
        team_a_user_ids: [],
        team_b_user_ids: [],
        match_id: MATCH_ID,
        match: { id: MATCH_ID, status: 'confirmed' },
      },
      TOURNAMENT_ID,
    );
    expect(cta.label).toBe('Ver partida');
    expect(cta.variant).toBe('secondary');
  });

  it('start href includes both tournament and pairing ids', () => {
    const cta = resolveHeroCta(
      {
        id: PAIRING_ID,
        round: 1,
        team_a_user_ids: [],
        team_b_user_ids: [],
        match_id: null,
        match: null,
      },
      TOURNAMENT_ID,
    );
    expect(cta.href).toContain(`tournament=${TOURNAMENT_ID}`);
    expect(cta.href).toContain(`pairing=${PAIRING_ID}`);
  });
});
