import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const REFERRAL_COOKIE = "dr_ref";
const REFERRAL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware: refresca la sesión de Supabase en cada request y captura
 * `?ref=<user_id>` en cookie `dr_ref` con first-touch semantics
 * (no sobrescribe si ya existe).
 */
export async function middleware(request: NextRequest) {
  // Exponemos el pathname (+search) al server-side vía header para que
  // requireUser pueda construir ?next=<url_actual> al redirigir a /login.
  // Sprint 3 decisión: preservar destino tras sesión expirada.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Referral first-touch: capturamos ?ref=<uuid> en cookie si aún no hay una.
  const refParam = request.nextUrl.searchParams.get("ref");
  if (refParam && UUID_RE.test(refParam) && !request.cookies.get(REFERRAL_COOKIE)) {
    response.cookies.set(REFERRAL_COOKIE, refParam, {
      path: "/",
      maxAge: REFERRAL_TTL_SECONDS,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
