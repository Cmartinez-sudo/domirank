// supabase/functions/send-push-notification/index.ts
// Deployed as a Supabase Edge Function (Deno runtime).
//
// Required secrets (set via Supabase Dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY     (preferred; mirror of NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        (e.g. "mailto:hello@domirank.app")
//   SUPABASE_URL                (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided by Supabase)
//
// Note: Supabase Edge Functions silently drop secrets whose name starts with
// "NEXT_PUBLIC_" or other reserved prefixes, so the public VAPID key must
// also be stored under a non-reserved name.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")
                   ?? Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY")
                   ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@domirank.app";

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("[send-push] missing VAPID secrets — function will reject requests.");
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ── Input validation ─────────────────────────────────────────────────────────
// Defense in depth: even though the only caller today is the DB trigger
// passing the service-role key, validate UUID format on inputs to fail fast
// on malformed payloads (logging noise, accidental misuse, future callers).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// ── Payload builder ──────────────────────────────────────────────────────────

type NotifRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  ref_match_id: string | null;
};

function buildPayload(notif: NotifRow): string {
  const base = {
    icon:  "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  };

  switch (notif.type) {
    case "attest_requested":
      return JSON.stringify({
        ...base,
        title: "DomiRank — Firma pendiente",
        body:  "Hay una partida esperando tu firma.",
        url:   notif.ref_match_id ? `/matches/${notif.ref_match_id}` : "/dashboard",
        tag:   `attest-${notif.ref_match_id ?? notif.id}`,
      });

    case "match_confirmed":
      return JSON.stringify({
        ...base,
        title: "DomiRank — Partida confirmada",
        body:  "Tu partida fue confirmada y el ranking fue actualizado.",
        url:   notif.ref_match_id ? `/matches/${notif.ref_match_id}` : "/dashboard",
        tag:   `confirmed-${notif.ref_match_id ?? notif.id}`,
      });

    case "match_disputed":
      return JSON.stringify({
        ...base,
        title: "DomiRank — Partida disputada",
        body:  "Un jugador disputó el resultado de la partida.",
        url:   notif.ref_match_id ? `/matches/${notif.ref_match_id}` : "/dashboard",
        tag:   `disputed-${notif.ref_match_id ?? notif.id}`,
      });

    case "friend_request_received":
      return JSON.stringify({
        ...base,
        title: "DomiRank — Solicitud de amistad",
        body:  "Alguien quiere agregarte como amigo.",
        url:   "/friends",
        tag:   `friend-${notif.id}`,
      });

    case "tournament_started":
      return JSON.stringify({
        ...base,
        title: "DomiRank — Torneo iniciado",
        body:  (notif.payload as { tournament_name?: string }).tournament_name
               ? `El torneo "${(notif.payload as { tournament_name: string }).tournament_name}" acaba de comenzar.`
               : "Tu torneo acaba de comenzar.",
        url:   "/tournaments",
        tag:   `tournament-${notif.id}`,
      });

    default:
      return JSON.stringify({
        ...base,
        title: "DomiRank",
        body:  "Tenés una nueva notificación.",
        url:   "/dashboard",
      });
  }
}

// ── Edge Function handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Caller must present the service-role key. The DB trigger passes it in
  // the Authorization header (Bearer ...). Without this check the function
  // would be a public push-spammer for any user_id.
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader  = req.headers.get("Authorization") ?? "";
  const tokenIn     = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!expectedKey || tokenIn !== expectedKey) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let notification_id: string;
  let user_id: string;

  try {
    const body = await req.json();
    if (!isUuid(body?.notification_id) || !isUuid(body?.user_id)) {
      throw new Error("invalid uuid");
    }
    notification_id = body.notification_id;
    user_id         = body.user_id;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Load the notification row
  const { data: notif, error: notifErr } = await supabase
    .from("notifications")
    .select("id, type, payload, ref_match_id")
    .eq("id", notification_id)
    .single<NotifRow>();

  if (notifErr || !notif) {
    return new Response(JSON.stringify({ error: "notification_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load all push subscriptions for the user
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (subsErr || !subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const payloadStr = buildPayload(notif);
  let sent   = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys:     { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadStr
      );

      // Update last_used_at on success
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sub.id);

      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;

      // RFC 8030: 410 = subscription gone. FCM/others return 404 too.
      // 401/403 typically mean the VAPID identity was rejected for this
      // endpoint (often: keys rotated, endpoint revoked) — also unrecoverable.
      if (statusCode === 404 || statusCode === 410 || statusCode === 403 || statusCode === 401) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
        console.warn(`[send-push] dropped sub ${sub.id} (status ${statusCode})`);
      } else {
        console.error(`[send-push] sub ${sub.id} failed (status ${statusCode ?? "?"}):`, err);
      }
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
