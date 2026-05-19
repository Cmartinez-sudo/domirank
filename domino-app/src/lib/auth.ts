import { supabaseServer } from "./supabase/server";
import { redirect } from "next/navigation";

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
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
