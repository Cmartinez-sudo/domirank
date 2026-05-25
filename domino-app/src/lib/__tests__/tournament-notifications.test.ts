import { describe, it, expect } from 'vitest';

// ─── Types replicated from notification-types (pure unit test) ───────────────

type NotificationPayload = Record<string, string | number | boolean | null>;

type NotificationType =
  | 'tournament_added'
  | 'tournament_started'
  | 'tournament_round_ready'
  | 'tournament_finished'
  | 'pair_invite_received'
  | 'pair_invite_accepted';

interface MockNotification {
  type: NotificationType;
  payload: NotificationPayload;
  ref_tournament_id: string | null;
  ref_user_id: string | null;
}

// ─── Pure helpers extracted from NotificationsList for testability ────────────

function buildNotificationText(n: MockNotification): string {
  if (n.type === 'tournament_added') {
    const tName = String(n.payload.tournament_name ?? '');
    return `Te agregaron al torneo ${tName}`;
  }
  if (n.type === 'tournament_started') {
    const tName = String(n.payload.tournament_name ?? '');
    return `El torneo ${tName} ya comenzó`;
  }
  if (n.type === 'tournament_round_ready') {
    return 'Nueva ronda disponible en tu torneo';
  }
  if (n.type === 'tournament_finished') {
    const tName = String(n.payload.tournament_name ?? '');
    return `El torneo ${tName} terminó. Mirá los resultados finales.`;
  }
  if (n.type === 'pair_invite_received') {
    const inviterName = String(n.payload.inviter_name ?? '');
    const tName = String(n.payload.tournament_name ?? '');
    return `${inviterName} te invita a ser su partner en ${tName}`;
  }
  if (n.type === 'pair_invite_accepted') {
    return 'aceptó tu invitación de partner';
  }
  return 'Nueva notificación';
}

/** Determina si la notificación tiene un botón de acción inline */
function hasActionButtons(n: MockNotification): boolean {
  if (n.type === 'pair_invite_received') {
    return Boolean(n.payload.invite_id);
  }
  return false;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID       = '00000000-0000-0000-0000-000000000002';
const INVITE_ID     = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';

describe('tournament_added notification', () => {
  it('includes the tournament name in the body', () => {
    const n: MockNotification = {
      type: 'tournament_added',
      payload: { tournament_name: 'Polla del barrio' },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: null,
    };
    expect(buildNotificationText(n)).toContain('Polla del barrio');
  });

  it('handles missing tournament_name gracefully', () => {
    const n: MockNotification = {
      type: 'tournament_added',
      payload: {},
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: null,
    };
    expect(buildNotificationText(n)).toBeTruthy();
  });
});

describe('tournament_started notification', () => {
  it('announces that the tournament started', () => {
    const n: MockNotification = {
      type: 'tournament_started',
      payload: { tournament_name: 'Copa DomiRank' },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: null,
    };
    const text = buildNotificationText(n);
    expect(text).toContain('Copa DomiRank');
    expect(text).toContain('comenzó');
  });
});

describe('pair_invite_received notification', () => {
  it('shows inviter name and tournament name', () => {
    const n: MockNotification = {
      type: 'pair_invite_received',
      payload: {
        tournament_name: 'Liga Mayo',
        inviter_name: 'Erik',
        invite_id: INVITE_ID,
      },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: USER_ID,
    };
    const text = buildNotificationText(n);
    expect(text).toContain('Erik');
    expect(text).toContain('Liga Mayo');
    expect(text).toContain('partner');
  });

  it('has action buttons when invite_id is present', () => {
    const n: MockNotification = {
      type: 'pair_invite_received',
      payload: { invite_id: INVITE_ID, inviter_name: 'Erik', tournament_name: 'Liga' },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: USER_ID,
    };
    expect(hasActionButtons(n)).toBe(true);
  });

  it('has no action buttons when invite_id is missing', () => {
    const n: MockNotification = {
      type: 'pair_invite_received',
      payload: { inviter_name: 'Erik', tournament_name: 'Liga' },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: USER_ID,
    };
    expect(hasActionButtons(n)).toBe(false);
  });
});

describe('tournament_finished notification', () => {
  it('mentions the tournament name and results', () => {
    const n: MockNotification = {
      type: 'tournament_finished',
      payload: { tournament_name: 'Copa Verano' },
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: null,
    };
    const text = buildNotificationText(n);
    expect(text).toContain('Copa Verano');
    expect(text).toContain('terminó');
  });
});

describe('tournament_round_ready notification', () => {
  it('renders correctly', () => {
    const n: MockNotification = {
      type: 'tournament_round_ready',
      payload: {},
      ref_tournament_id: TOURNAMENT_ID,
      ref_user_id: null,
    };
    expect(buildNotificationText(n)).toContain('ronda');
  });
});
