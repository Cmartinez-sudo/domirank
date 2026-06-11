import { sendEmail } from '@/lib/email';
import type { RenderedEmail } from './email-templates';

export type EmailFromOverride = {
  /** Email address. Domain MUST be verified in Resend. */
  fromEmail?: string;
  fromName?: string;
};

export type SendClubProEmailArgs = {
  to: string;
  template: RenderedEmail;
  /** Per-org sender override. Domain must be verified in Resend. */
  from?: EmailFromOverride;
  /**
   * Idempotency key — if the same key was already used in this process,
   * the send is skipped and `true` returned. Useful when an invitation
   * trigger fires twice (UI double-click, retry, etc.) within the same
   * server instance. NOTE: in-memory only — does not survive restarts
   * or cross-instance. Phase-3 can layer a DB-backed idempotency on top.
   */
  idempotencyKey?: string;
};

/**
 * In-memory idempotency cache. Lives for the lifetime of the Node process.
 * Bounded to 10k entries to avoid memory bloat on long-running servers.
 */
const sentKeys = new Set<string>();
const SENT_KEYS_MAX = 10_000;

export async function sendClubProEmail(args: SendClubProEmailArgs): Promise<boolean> {
  const { to, template, from, idempotencyKey } = args;

  if (idempotencyKey && sentKeys.has(idempotencyKey)) {
    console.warn('[club-pro email] idempotency hit — skipping duplicate send', {
      key: idempotencyKey,
      to,
    });
    return true;
  }

  const fromHeader = buildFromHeader(from);

  const ok = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    from: fromHeader,
  });

  if (ok && idempotencyKey) {
    if (sentKeys.size >= SENT_KEYS_MAX) sentKeys.clear();
    sentKeys.add(idempotencyKey);
  }

  return ok;
}

function buildFromHeader(from?: EmailFromOverride): string | undefined {
  if (!from?.fromEmail) return undefined;
  // Strip CR/LF to prevent SMTP header injection if fromName comes from
  // untrusted input (e.g. an org admin sets brand name with embedded
  // newlines). Resend likely sanitizes server-side too, but defense in
  // depth — the client should not emit malformed headers either way.
  // We also strip the angle brackets that would break the "Name <email>" format.
  if (from.fromName) {
    const safeName = from.fromName.replace(/[\r\n<>]/g, ' ').trim();
    if (safeName) return `${safeName} <${from.fromEmail}>`;
  }
  return from.fromEmail;
}

// Exported for tests only — clears the idempotency cache so each test starts fresh.
export function _clearIdempotencyCacheForTests(): void {
  sentKeys.clear();
}
