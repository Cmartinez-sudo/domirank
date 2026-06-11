import { describe, test, expect } from 'vitest';
import { claimSuccessEmail } from '../claim-success';

const baseInput = {
  recipientName: 'Carlos Martinez',
  tournamentName: 'Copa Invedin 2026',
  orgName: 'Invedin',
  playerDashboardUrl: 'https://domirank.app/me/tournaments/abc',
};

describe('claimSuccessEmail', () => {
  test('renders with all fields', () => {
    const email = claimSuccessEmail(baseInput);
    expect(email.subject).toContain('Carlos Martinez');
    expect(email.html).toContain('Carlos Martinez');
    expect(email.html).toContain('Copa Invedin 2026');
    expect(email.html).toContain('Invedin');
    expect(email.html).toContain('https://domirank.app/me/tournaments/abc');
  });

  test('plain text has no HTML tags', () => {
    const email = claimSuccessEmail(baseInput);
    expect(email.text).not.toContain('<');
    expect(email.text).not.toContain('>');
  });

  test('no scripts in HTML', () => {
    const email = claimSuccessEmail({
      ...baseInput,
      recipientName: '<script>alert(1)</script>',
    });
    expect(email.html).not.toMatch(/<script>alert/);
    expect(email.html).toContain('&lt;script&gt;');
  });
});
