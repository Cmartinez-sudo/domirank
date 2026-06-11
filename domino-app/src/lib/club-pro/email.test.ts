import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendClubProEmail, _clearIdempotencyCacheForTests } from './email';

const template = {
  subject: 'Test subject',
  html: '<p>hello</p>',
  text: 'hello',
};

describe('sendClubProEmail', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEnv = process.env.RESEND_FROM_EMAIL;

  beforeEach(() => {
    _clearIdempotencyCacheForTests();
    process.env.RESEND_API_KEY = 'test_key';
    delete process.env.RESEND_FROM_EMAIL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFromEnv === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFromEnv;
    vi.restoreAllMocks();
  });

  test('uses default From when no override given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendClubProEmail({ to: 'a@b.com', template });
    expect(ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    // Default DomiRank sender when no env override
    expect(body.from).toMatch(/DomiRank.*onboarding@resend\.dev|DomiRank.*domirank\.app/);
  });

  test('honors fromEmail + fromName override', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await sendClubProEmail({
      to: 'a@b.com',
      template,
      from: { fromEmail: 'club@invedin.org', fromName: 'Invedin' },
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.from).toBe('Invedin <club@invedin.org>');
  });

  test('honors fromEmail without fromName', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await sendClubProEmail({
      to: 'a@b.com',
      template,
      from: { fromEmail: 'club@invedin.org' },
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.from).toBe('club@invedin.org');
  });

  test('idempotencyKey: second call with same key does not call fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const first = await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'invite-pair-42' });
    expect(first).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'invite-pair-42' });
    expect(second).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still 1
  });

  test('different idempotencyKeys each trigger their own send', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'key-1' });
    await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'key-2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('no idempotencyKey: each call sends', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await sendClubProEmail({ to: 'a@b.com', template });
    await sendClubProEmail({ to: 'a@b.com', template });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('without RESEND_API_KEY: returns false and does NOT fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    delete process.env.RESEND_API_KEY;

    const ok = await sendClubProEmail({ to: 'a@b.com', template });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('Resend API non-OK response: returns false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate_limit', { status: 429 }));
    global.fetch = fetchMock as typeof fetch;

    const ok = await sendClubProEmail({ to: 'a@b.com', template });
    expect(ok).toBe(false);
  });

  test('failed send does NOT mark idempotencyKey as sent (allows retry)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate_limit', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const first = await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'retry-me' });
    expect(first).toBe(false);

    const second = await sendClubProEmail({ to: 'a@b.com', template, idempotencyKey: 'retry-me' });
    expect(second).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2); // retry happened
  });
});
