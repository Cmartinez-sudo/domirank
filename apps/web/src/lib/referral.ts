// Referral system (Sprint 1a).
// Cookie-based first-touch attribution. El middleware setea `dr_ref` cuando
// llega `?ref=<user_id>`; auth/callback lo consume tras signup, popula
// profiles.referred_by y notifica al referrer.

import { cookies } from "next/headers";
import { supabaseService } from "@/lib/supabase/service";

export const REFERRAL_COOKIE = "dr_ref";
export const REFERRAL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

/** Lee la cookie `dr_ref` del request actual (server-side). */
export function getReferralCookie(): string | null {
  const raw = cookies().get(REFERRAL_COOKIE)?.value;
  if (!raw) return null;
  // Validar formato UUID mínimo para evitar basura.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return null;
  }
  return raw;
}

/** Borra la cookie de referral tras atribuir. */
export function clearReferralCookie(): void {
  cookies().set(REFERRAL_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: false, // cliente puede leerla para debugging; no es secret
  });
}

/**
 * Devuelve un perfil mínimo del referrer (para renderizar P1-referido).
 * Usa service_role — el nuevo user aún no tiene sesión completa cuando
 * lo llamamos desde el callback, y la RLS de perfiles requiere auth.uid().
 */
export async function resolveReferrer(referrerId: string): Promise<{
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
} | null> {
  const svc = supabaseService();
  const { data } = await svc
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", referrerId)
    .maybeSingle();
  if (!data) return null;
  return data as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Atribución post-signup: si `dr_ref` cookie existe y el nuevo usuario no
 * tiene `referred_by` (el trigger ya la puede haber puesto vía metadata),
 * la populamos aquí como fallback (OAuth signup no manda metadata).
 *
 * Dedupe por email: si otra cuenta con el mismo email ya tenía otro
 * referred_by, NO sobrescribimos.
 *
 * @returns el referrer_id atribuido, o null si no aplicó.
 */
export async function attributeReferral(newUserId: string, newUserEmail: string | null): Promise<string | null> {
  const cookie = getReferralCookie();
  if (!cookie) return null;
  if (cookie === newUserId) {
    clearReferralCookie();
    return null;
  }

  const svc = supabaseService();

  // Verificar estado actual del perfil (el trigger handle_new_user ya
  // puede haber corrido con metadata.referred_by, o no).
  const { data: myProfile } = await svc
    .from("profiles")
    .select("id, referred_by")
    .eq("id", newUserId)
    .maybeSingle();

  if (!myProfile) {
    // Aún no creado (race con trigger). Salimos silencioso — el callback
    // volverá a intentar en el próximo request o no aplicará.
    return null;
  }

  const existingReferrer = (myProfile as { referred_by: string | null }).referred_by;
  if (existingReferrer) {
    // Ya tenía referrer (posiblemente via metadata en signup). Limpia cookie.
    clearReferralCookie();
    return existingReferrer;
  }

  // Dedupe: si el email coincide con otra cuenta con otro referred_by,
  // el spam sería obvio. Aceptamos la primera cuenta que reclame el email.
  // (En Supabase auth.users.email es UNIQUE, no debería haber colisión real.)
  if (newUserEmail) {
    const { data: emailPeers } = await svc.auth.admin.listUsers();
    const peer = emailPeers?.users?.find(
      (u) => u.email === newUserEmail && u.id !== newUserId,
    );
    if (peer) {
      const { data: peerProfile } = await svc
        .from("profiles")
        .select("referred_by")
        .eq("id", peer.id)
        .maybeSingle();
      if (peerProfile && (peerProfile as { referred_by: string | null }).referred_by) {
        clearReferralCookie();
        return null;
      }
    }
  }

  // Verificar que el referrer existe.
  const { data: refExists } = await svc
    .from("profiles")
    .select("id")
    .eq("id", cookie)
    .maybeSingle();
  if (!refExists) {
    clearReferralCookie();
    return null;
  }

  const { error } = await svc
    .from("profiles")
    .update({
      referred_by: cookie,
      referral_registered_at: new Date().toISOString(),
    } as never)
    .eq("id", newUserId);

  clearReferralCookie();
  if (error) {
    console.error("[attributeReferral] update failed:", error.message);
    return null;
  }
  return cookie;
}
