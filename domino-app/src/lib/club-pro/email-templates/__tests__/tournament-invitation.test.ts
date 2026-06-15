import { describe, test, expect } from 'vitest';
import { tournamentInvitationEmail } from '../tournament-invitation';

const baseInput = {
  recipientName: 'Carlos Martinez',
  partnerName: 'Ana López',
  tournamentName: 'Copa Invedin 2026',
  orgName: 'Invedin',
  targetPoints: 100,
  roundsCount: 5,
  roundDurationMinutes: 25,
  waitlistUrl: 'https://domirank.app',
};

describe('tournamentInvitationEmail', () => {
  test('renders welcome with player + partner names', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).toContain('Carlos Martinez');
    expect(email.html).toContain('Ana López');
    expect(email.html).toContain('Copa Invedin 2026');
    expect(email.html).toContain('Invedin');
    expect(email.text).toContain('Carlos Martinez');
    expect(email.text).toContain('Ana López');
  });

  test('subject contains org name and tournament name', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.subject).toContain('Invedin');
    expect(email.subject).toContain('Copa Invedin 2026');
  });

  test('shows tournament parameters in the body', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).toContain('100 tantos');
    expect(email.html).toContain('25 minutos');
    expect(email.html).toContain('Rondas');
    // Plain text is unambiguous — "Rondas: 5"
    expect(email.text).toMatch(/Rondas:\s*5/);
    expect(email.text).toContain('100 tantos');
    expect(email.text).toContain('25 minutos');
  });

  test('explains the three champion criteria', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).toContain('Partidas ganadas');
    expect(email.html).toContain('Coeficiente de Efectividad');
    expect(email.html).toContain('Tantos acumulados');
    expect(email.text).toContain('Partidas ganadas');
    expect(email.text).toContain('Coeficiente de Efectividad');
    expect(email.text).toContain('Tantos acumulados');
  });

  test('single CTA: waitlist URL in an <a href>', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      waitlistUrl: 'https://domirank.app',
    });
    expect(email.html).toMatch(/href="https:\/\/domirank\.app"/);
    expect(email.html).toContain('Apuntarme al waitlist');
  });

  test('renders DomiRank hero logo', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).toContain('domirank.app/branding/logo-square-tagline.svg');
  });

  test('renders org logo when orgLogoUrl is provided', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      orgLogoUrl: 'https://example.com/invedin.png',
    });
    expect(email.html).toContain('https://example.com/invedin.png');
  });

  test('omits org logo block when orgLogoUrl is missing', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).not.toMatch(/<img[^>]*alt="Invedin"/);
  });

  test('renders sponsor logos when both URLs are provided', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      sponsor1LogoUrl: 'https://example.com/criafama.png',
      sponsor2LogoUrl: 'https://example.com/banco-plaza.png',
    });
    expect(email.html).toContain('https://example.com/criafama.png');
    expect(email.html).toContain('https://example.com/banco-plaza.png');
    expect(email.html).toContain('Patrocinan este torneo');
  });

  test('omits sponsors block entirely when no sponsor URLs', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).not.toContain('Patrocinan este torneo');
  });

  test('renders only sponsor 1 if sponsor 2 missing', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      sponsor1LogoUrl: 'https://example.com/criafama.png',
    });
    expect(email.html).toContain('https://example.com/criafama.png');
    expect(email.html).toContain('Patrocinan este torneo');
  });

  test('plain text has no HTML tags', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.text).not.toContain('<');
    expect(email.text).not.toContain('>');
  });

  test('escapes HTML in tournament name (XSS)', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      tournamentName: '<script>alert(1)</script>',
    });
    expect(email.html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(email.html).toContain('&lt;script&gt;');
  });

  test('escapes HTML in recipient name', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      recipientName: 'Carlos "Charly" <script>',
    });
    expect(email.html).not.toMatch(/<script>/);
    expect(email.html).toContain('&quot;');
  });

  test('waitlist URL with javascript: rejected, becomes #', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      waitlistUrl: 'javascript:alert(1)',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).toMatch(/href="#"/);
  });

  test('sponsor URL with javascript: dropped (no img tag rendered)', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      sponsor1LogoUrl: 'javascript:alert(1)',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).not.toMatch(/<img src="javascript:/);
  });

  test('orgLogoUrl with javascript: rejected', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      orgLogoUrl: 'javascript:alert(1)',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).not.toMatch(/<img src="javascript:/);
  });

  test('http URLs allowed (for localhost during dev)', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      waitlistUrl: 'http://localhost:3000',
    });
    expect(email.html).toContain('http://localhost:3000');
  });
});
