import { describe, test, expect } from 'vitest';
import { tournamentInvitationEmail } from '../tournament-invitation';

const baseInput = {
  recipientName: 'Carlos Martinez',
  tournamentName: 'Copa Invedin 2026',
  orgName: 'Invedin',
  scheduledStartAt: '2026-07-15T19:00:00.000Z',
  partnerName: 'Ana López',
  claimUrl: 'https://domirank.app/claim/abc123',
};

describe('tournamentInvitationEmail', () => {
  test('renders with all required fields', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.subject).toBe('Invedin — Invitación al torneo "Copa Invedin 2026"');
    expect(email.html).toContain('Carlos Martinez');
    expect(email.html).toContain('Copa Invedin 2026');
    expect(email.html).toContain('Ana López');
    expect(email.html).toContain('https://domirank.app/claim/abc123');
    expect(email.text).toContain('Carlos Martinez');
    expect(email.text).toContain('Copa Invedin 2026');
    expect(email.text).toContain('https://domirank.app/claim/abc123');
  });

  test('subject starts with the org name', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.subject.startsWith('Invedin')).toBe(true);
  });

  test('claimUrl appears in an <a href="...">', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).toMatch(/href="https:\/\/domirank\.app\/claim\/abc123"/);
  });

  test('plain text version has no HTML tags', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.text).not.toContain('<');
    expect(email.text).not.toContain('>');
  });

  test('renders with logo and brand color when provided', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      orgLogoUrl: 'https://example.com/logo.png',
      orgBrandColor: '#FF5500',
    });
    expect(email.html).toContain('https://example.com/logo.png');
    expect(email.html).toContain('#FF5500');
  });

  test('falls back to text header when no logo', () => {
    const email = tournamentInvitationEmail(baseInput);
    // No logo → org name shown as text in header
    expect(email.html).toMatch(/<div[^>]*>Invedin<\/div>/);
  });

  test('ignores invalid brand color (uses default dark)', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      orgBrandColor: 'javascript:alert(1)',
    });
    // Invalid color → falls back to default #0f172a
    expect(email.html).not.toContain('javascript:');
    expect(email.html).toContain('#0f172a');
  });

  test('includes venue when provided', () => {
    const email = tournamentInvitationEmail({ ...baseInput, venue: 'Club Italo, Caracas' });
    expect(email.html).toContain('Club Italo, Caracas');
    expect(email.text).toContain('Club Italo, Caracas');
  });

  test('omits venue block when not provided', () => {
    const email = tournamentInvitationEmail(baseInput);
    expect(email.html).not.toContain('<strong>Lugar:</strong>');
    expect(email.text).not.toContain('Lugar:');
  });

  test('escapes HTML in tournament name (XSS defense)', () => {
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

  test('handles invalid ISO date gracefully', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      scheduledStartAt: 'not-a-date',
    });
    // Should fall back to the raw string instead of "Invalid Date"
    expect(email.html).toContain('not-a-date');
  });

  test('claimUrl with javascript: protocol replaced by # (XSS defense)', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      claimUrl: 'javascript:alert(1)',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).toMatch(/href="#"/);
  });

  test('claimUrl with data: protocol rejected', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      claimUrl: 'data:text/html,<script>alert(1)</script>',
    });
    expect(email.html).not.toMatch(/data:text\/html/);
  });

  test('orgLogoUrl with javascript: rejected, falls back to text header', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      orgLogoUrl: 'javascript:alert(1)',
    });
    expect(email.html).not.toContain('javascript:');
    expect(email.html).not.toMatch(/<img src="javascript:/);
    // Fall back to text header
    expect(email.html).toMatch(/<div[^>]*>Invedin<\/div>/);
  });

  test('http (non-https) URLs are allowed for dev/localhost', () => {
    const email = tournamentInvitationEmail({
      ...baseInput,
      claimUrl: 'http://localhost:3000/claim/xyz',
    });
    expect(email.html).toContain('http://localhost:3000/claim/xyz');
  });
});
