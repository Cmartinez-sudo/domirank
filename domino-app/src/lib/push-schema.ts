import { z } from "zod";

// Web Push spec maximum sizes:
//   endpoint   FCM/Mozilla/Apple URLs are <300 chars in practice; cap at 2048
//   p256dh     P-256 ECDH public key base64url ≈ 88 chars; cap at 256
//   auth       16-byte secret base64url ≈ 22 chars; cap at 64
//   user_agent string from navigator.userAgent; cap at 512
// Cap = (typical * ~3) margin without enabling DoS via giant payloads.

export const pushEndpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), { message: "endpoint must be https" });

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
