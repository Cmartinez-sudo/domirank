import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware: refresca la sesión de Supabase en cada request.
 * Necesario para que server components vean la sesión actualizada.
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
