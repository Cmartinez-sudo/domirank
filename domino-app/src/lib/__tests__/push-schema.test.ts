import { describe, it, expect } from 'vitest';
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushEndpointSchema,
  MAX_PUSH_BODY_BYTES,
} from '../push-schema';

const validEndpoint = 'https://fcm.googleapis.com/fcm/send/abc123';
const validP256dh = 'B'.repeat(88);
const validAuth = 'A'.repeat(22);

describe('pushEndpointSchema', () => {
  it('acepta URL https válida', () => {
    expect(pushEndpointSchema.safeParse(validEndpoint).success).toBe(true);
  });

  it('rechaza http (no es https)', () => {
    expect(pushEndpointSchema.safeParse('http://fcm.googleapis.com/x').success).toBe(false);
  });

  it('rechaza endpoint vacío', () => {
    expect(pushEndpointSchema.safeParse('').success).toBe(false);
  });

  it('rechaza endpoint que supera 2048 caracteres', () => {
    const huge = 'https://x.com/' + 'a'.repeat(2050);
    expect(pushEndpointSchema.safeParse(huge).success).toBe(false);
  });

  it('rechaza string que no es URL', () => {
    expect(pushEndpointSchema.safeParse('not-a-url').success).toBe(false);
  });
});

describe('pushSubscribeSchema', () => {
  it('acepta payload válido', () => {
    const ok = pushSubscribeSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: validP256dh, auth: validAuth },
      user_agent: 'Mozilla/5.0',
    });
    expect(ok.success).toBe(true);
  });

  it('acepta payload sin user_agent (opcional)', () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: validEndpoint,
        keys: { p256dh: validP256dh, auth: validAuth },
      }).success,
    ).toBe(true);
  });

  it('rechaza p256dh que excede 256 chars', () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: validEndpoint,
        keys: { p256dh: 'B'.repeat(300), auth: validAuth },
      }).success,
    ).toBe(false);
  });

  it('rechaza auth que excede 64 chars', () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: validEndpoint,
        keys: { p256dh: validP256dh, auth: 'A'.repeat(100) },
      }).success,
    ).toBe(false);
  });

  it('rechaza user_agent que excede 512 chars', () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: validEndpoint,
        keys: { p256dh: validP256dh, auth: validAuth },
        user_agent: 'x'.repeat(600),
      }).success,
    ).toBe(false);
  });

  it('rechaza p256dh vacío', () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: validEndpoint,
        keys: { p256dh: '', auth: validAuth },
      }).success,
    ).toBe(false);
  });

  it('rechaza payload sin keys', () => {
    expect(
      pushSubscribeSchema.safeParse({ endpoint: validEndpoint }).success,
    ).toBe(false);
  });
});

describe('pushUnsubscribeSchema', () => {
  it('acepta endpoint válido', () => {
    expect(pushUnsubscribeSchema.safeParse({ endpoint: validEndpoint }).success).toBe(true);
  });

  it('rechaza endpoint http', () => {
    expect(pushUnsubscribeSchema.safeParse({ endpoint: 'http://x.com' }).success).toBe(false);
  });

  it('rechaza payload sin endpoint', () => {
    expect(pushUnsubscribeSchema.safeParse({}).success).toBe(false);
  });
});

describe('MAX_PUSH_BODY_BYTES', () => {
  it('es 4096 (4 KiB) — margen sobre payload típico', () => {
    expect(MAX_PUSH_BODY_BYTES).toBe(4096);
  });
});
