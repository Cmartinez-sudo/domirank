import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { attributeReferral, resolveReferrer } from "@/lib/referral";
import { createReferralSignupNotification } from "@/lib/notifications";
import { joinGroupByCode } from "@/lib/group-join-code";
import { supabaseService } from "@/lib/supabase/service";
import { checkAndFireFirstValuableAction } from "@/lib/activation";

const PENDING_GROUP_JOIN_COOKIE = "pending_group_join";

/**
 * Callback de auth para OAuth, magic links, password reset, signup confirm.
 * Recibe `?code=...` y opcionalmente `?next=/path`.
 *
 * Construye el redirect usando x-forwarded-host (set por Vercel) para evitar
 * que el redirect caiga en un hostname interno de Vercel cuando el usuario
 * vino desde el dominio custom (domirank.app).
 */
/**
 * Acepta solo paths internos relativos para evitar open redirects.
 * Rechaza: URLs absolutas, protocol-relative (//evil.com), backslash tricks.
 */
function safeNext(next: string | null): string | null {
  if (!next) return null;
  // Debe empezar con un único "/" y no debe contener un esquema o autoridad.
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/**
 * Returns just the pathname portion of a same-origin path, stripping any
 * query string or hash. Used in logs to avoid leaking tokens (e.g. the
 * Supabase recovery code carried in `?next=/reset-password?token=...`
 * or `?next=/x#access_token=...`).
 */
function logSafePath(path: string | null): string {
  if (!path) return "(none)";
  const qIdx = path.indexOf("?");
  const hIdx = path.indexOf("#");
  const cut = [qIdx, hIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut !== undefined ? path.slice(0, cut) : path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = safeNext(url.searchParams.get("next"));

  // Determinar el origin "real" del request (el que el usuario ve en su URL bar)
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  console.log("[auth/callback] origin:", origin, "code present:", !!code, "next:", logSafePath(requestedNext));

  if (!code) {
    console.warn("[auth/callback] no code in callback URL");
    return NextResponse.redirect(`${origin}/login?error=auth_no_code`);
  }

  const supabase = await supabaseServer();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`);
  }

  // Determinar destino:
  //   - requestedNext (e.g., /reset-password) tiene prioridad
  //   - si onboarded=false → /onboarding
  //   - default → /dashboard
  const { data: { user } } = await supabase.auth.getUser();
  let target = requestedNext ?? "/dashboard";

  if (user) {
    // Sprint 1a: atribución de referral (first-touch cookie dr_ref).
    // Corre para signups Y logins de usuarios que aún no tenían referred_by
    // — cubre el caso OAuth donde la metadata no llega al trigger.
    try {
      const referrerId = await attributeReferral(user.id, user.email ?? null);
      if (referrerId) {
        // Fetch nuevo perfil para copy de la notif.
        const svc = supabaseService();
        const { data: newProfile } = await svc
          .from("profiles")
          .select("id, username, display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (newProfile) {
          const p = newProfile as { id: string; username: string; display_name: string | null };
          await createReferralSignupNotification(referrerId, p);
        }
        // Sprint 1b: para el referrer, este signup cuenta como
        // first_valuable_action vía "invite_accepted".
        await checkAndFireFirstValuableAction(referrerId, "invite_accepted");
        // Attach al request para logging.
        console.log("[auth/callback] referral attributed:", referrerId, "→", user.id);
      }
    } catch (e) {
      console.error("[auth/callback] referral attribution failed:", e);
    }

    // Sprint 1a: si hay pending_group_join (usuario abrió /g/<code> sin sesión),
    // procesar la unión antes del redirect final.
    const pendingCode = cookies().get(PENDING_GROUP_JOIN_COOKIE)?.value;
    if (pendingCode) {
      cookies().set(PENDING_GROUP_JOIN_COOKIE, "", { path: "/", maxAge: 0 });
      try {
        const r = await joinGroupByCode({ code: pendingCode });
        if (r.ok) {
          target = `/groups/${r.data!.groupId}`;
        }
      } catch (e) {
        console.error("[auth/callback] pending group join failed:", e);
      }
    }

    if (!requestedNext && target === "/dashboard") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .single();
      if (profile && profile.onboarded === false) {
        target = "/onboarding";
      }
    }
  }

  console.log("[auth/callback] redirecting to", `${origin}${logSafePath(target)}`);
  return NextResponse.redirect(`${origin}${target}`);
}
