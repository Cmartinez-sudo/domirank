import { describe, test, expect } from 'vitest';
import { roundStartedEmail } from '../round-started';

const baseInput = {
  recipientName: 'Carlos Martinez',
  tournamentName: 'Copa Invedin 2026',
  roundNumber: 3,
  tableNumber: 5,
  opponentPairName: 'Ana López & Pedro Rojas',
  targetPoints: 200,
};

describe('roundStartedEmail', () => {
  test('subject contains round number and table number', () => {
    const email = roundStartedEmail(baseInput);
    expect(email.subject).toContain('Ronda 3');
    expect(email.subject).toContain('Mesa 5');
  });

  test('renders all input fields in html', () => {
    const email = roundStartedEmail(baseInput);
    expect(email.html).toContain('Carlos Martinez');
    expect(email.html).toContain('Copa Invedin 2026');
    expect(email.html).toContain('Ana López &amp; Pedro Rojas');
    expect(email.html).toContain('200');
  });

  test('plain text mirrors html content without tags', () => {
    const email = roundStartedEmail(baseInput);
    expect(email.text).toContain('Carlos Martinez');
    expect(email.text).toContain('Ana López & Pedro Rojas'); // raw & in text
    expect(email.text).not.toContain('<');
    expect(email.text).not.toContain('>');
  });

  test('escapes XSS in opponent pair name', () => {
    const email = roundStartedEmail({
      ...baseInput,
      opponentPairName: '<img src=x onerror=alert(1)>',
    });
    expect(email.html).not.toMatch(/<img src=x/);
    expect(email.html).toContain('&lt;img');
  });
});
