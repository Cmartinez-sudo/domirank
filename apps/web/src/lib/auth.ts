import { supabaseServer } from "./supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profile_ratings")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile;
}

/**
 * Construye /login?next=<current_pathname> para que tras re-autenticarse el
 * usuario vuelva exactamente donde estaba (Sprint 3: sesión expirada a mitad
 * de partida). El pathname viene de un request header seteado por middleware.
 *
 * Sólo consideramos rutas internas seguras. Rutas de auth (/login, /signup,
 * /auth/*) NO se propagan como next para evitar loops.
 */
async function buildLoginRedirect(): Promise<string> {
  try {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "";
    if (!pathname || !pathname.startsWith("/")) return "/login";
    // Excluir rutas de auth para prevenir loops.
    if (
      pathname === "/login" ||
      pathname.startsWith("/login?") ||
      pathname === "/signup" ||
      pathname.startsWith("/signup?") ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password")
    ) {
      return "/login";
    }
    return `/login?next=${encodeURIComponent(pathname)}`;
  } catch {
    return "/login";
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(await buildLoginRedirect());
  return user;
}

/**
 * Igual que requireUser pero además fuerza que el perfil tenga onboarding completo.
 * Usar en páginas que asumen país + modalidad default (crear partida, dashboard, etc.).
 */
export async function requireOnboardedUser() {
  const user = await requireUser();
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarded) redirect("/onboarding");
  return user;
}
