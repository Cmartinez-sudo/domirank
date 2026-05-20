/**
 * Envío de email transaccional vía Resend REST API.
 *
 * Configuración (env vars):
 *   RESEND_API_KEY      — obligatorio en producción. Sin él, sendEmail() es no-op.
 *   RESEND_FROM_EMAIL   — remitente. Default: "DomiRank <onboarding@resend.dev>"
 *                          (solo sirve para enviar a la propia cuenta verificada
 *                          de Resend; para enviar a cualquier email hay que
 *                          verificar un dominio en Resend).
 *
 * Diseño:
 *   - Falla silenciosamente (devuelve false + log) si no hay API key.
 *   - Devuelve booleano; nunca throws. Los callers (sendFriendRequest, etc.)
 *     llaman fire-and-forget con try/catch para no romper la operación principal.
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const FROM = process.env.RESEND_FROM_EMAIL ?? "DomiRank <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", to);
    return false;
  }
  if (!to) {
    console.warn("[email] missing recipient");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend API error", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] fetch failed", err);
    return false;
  }
}

/* ============================================================
   URL helper compartido entre auth-actions y email templates
   ============================================================ */

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
