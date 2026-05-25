/**
 * Rate limiting via Upstash Redis.
 * Fails open when UPSTASH_REDIS_REST_URL / TOKEN are not set (local dev).
 * Set both env vars in Vercel to activate in production.
 *
 * Limits (sliding window):
 *   auth               — 10 attempts / 1 min  per IP     (brute-force / signup spam)
 *   matchStart         — 15 matches  / 1 hour per user   (rating manipulation)
 *   tournament         —  5 created  / 1 day  per user   (spam)
 *   friendReq          — 20 requests / 1 hour per user   (spam)
 *   tournamentMutation — 30 ops      / 1 min  per user   (R5 pair management)
 */

import { Ratelimit }  from "@upstash/ratelimit";
import { Redis }      from "@upstash/redis";

function make(requests: number, window: string): Ratelimit | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis:   new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, window as never),
    prefix:  "domirank",
  });
}

export const rl = {
  auth:               make(10, "1 m"),
  matchStart:         make(15, "1 h"),
  tournament:         make(5,  "1 d"),
  friendReq:          make(20, "1 h"),
  tournamentMutation: make(30, "1 m"),
};

export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  if (!limiter) return { allowed: true };
  const { success } = await limiter.limit(identifier);
  return success
    ? { allowed: true }
    : { allowed: false, error: "Demasiadas operaciones. Intentá de nuevo en un minuto." };
}
