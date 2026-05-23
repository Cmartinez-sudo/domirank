import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = safeNext(url.searchParams.get("next"));

  // Determinar el origin "real" del request (el que el usuario ve en su URL bar)
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  console.log("[auth/callback] origin:", origin, "code present:", !!code, "next:", requestedNext);

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

  if (user && !requestedNext) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .single();
    if (profile && profile.onboarded === false) {
      target = "/onboarding";
    }
  }

  console.log("[auth/callback] redirecting to", `${origin}${target}`);
  return NextResponse.redirect(`${origin}${target}`);
}
