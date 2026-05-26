import { z } from "zod";

// Web Push spec maximum sizes:
//   endpoint   FCM/Mozilla/Apple URLs are <300 chars in practice; cap at 2048
//   p256dh     P-256 ECDH public key base64url ≈ 88 chars; cap at 256
//   auth       16-byte secret base64url ≈ 22 chars; cap at 64
//   user_agent string from navigator.userAgent; cap at 512
// Cap = (typical * ~3) margin without enabling DoS via giant payloads.

// Known push providers used by the major browsers (Chrome/Edge/Firefox/Safari).
// Anything outside this set is rejected: stops a compromised client/extension
// from registering an attacker-controlled URL that web-push would later POST to.
const ALLOWED_PUSH_HOST_EXACT = new Set<string>([
  "fcm.googleapis.com", // Chrome, Edge (current), Android Chrome, Opera
  "updates.push.services.mozilla.com", // Firefox
]);

const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".push.apple.com", // Safari WebPush (web.push.apple.com, etc.)
  ".notify.windows.com", // Edge legacy / WNS
] as const;

export function isAllowedPushHost(host: string): boolean {
  if (ALLOWED_PUSH_HOST_EXACT.has(host)) return true;
  return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export const pushEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), { message: "endpoint must be https" })
  .refine(
    (u) => {
      try {
        return isAllowedPushHost(new URL(u).host);
      } catch {
        return false;
      }
    },
    { message: "endpoint host not in allowed push services" },
  );

export const pushSubscribeSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
  user_agent: z.string().max(512).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: pushEndpointSchema,
});

export const MAX_PUSH_BODY_BYTES = 4096;
