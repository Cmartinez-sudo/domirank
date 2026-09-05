import { describe, it, expect } from 'vitest';
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushEndpointSchema,
  isAllowedPushHost,
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

describe('isAllowedPushHost (M8 whitelist)', () => {
  it('acepta FCM (Chrome/Edge/Android)', () => {
    expect(isAllowedPushHost('fcm.googleapis.com')).toBe(true);
  });

  it('acepta Mozilla (Firefox)', () => {
    expect(isAllowedPushHost('updates.push.services.mozilla.com')).toBe(true);
  });

  it('acepta hosts bajo .push.apple.com (Safari WebPush)', () => {
    expect(isAllowedPushHost('web.push.apple.com')).toBe(true);
    expect(isAllowedPushHost('api.push.apple.com')).toBe(true);
  });

  it('acepta hosts bajo .notify.windows.com (Edge legacy / WNS)', () => {
    expect(isAllowedPushHost('db5.notify.windows.com')).toBe(true);
  });

  it('rechaza dominios no listados', () => {
    expect(isAllowedPushHost('attacker.com')).toBe(false);
    expect(isAllowedPushHost('evil.example.org')).toBe(false);
  });

  it('rechaza intentos de tricky subdomain ("fcm.googleapis.com.attacker.com")', () => {
    expect(isAllowedPushHost('fcm.googleapis.com.attacker.com')).toBe(false);
  });

  it('rechaza intentos de suffix-match con dominio falso ("evilpush.apple.com.attacker.com")', () => {
    expect(isAllowedPushHost('push.apple.com.attacker.com')).toBe(false);
  });

  it('rechaza host vacío', () => {
    expect(isAllowedPushHost('')).toBe(false);
  });
});

describe('pushEndpointSchema — host whitelist integration', () => {
  it('rechaza https://attacker.com/x aunque sea https válido', () => {
    expect(pushEndpointSchema.safeParse('https://attacker.com/x').success).toBe(false);
  });

  it('acepta endpoint Mozilla', () => {
    expect(
      pushEndpointSchema.safeParse('https://updates.push.services.mozilla.com/wpush/v2/abc').success,
    ).toBe(true);
  });

  it('acepta endpoint Safari WebPush', () => {
    expect(
      pushEndpointSchema.safeParse('https://web.push.apple.com/abc123').success,
    ).toBe(true);
  });
});
