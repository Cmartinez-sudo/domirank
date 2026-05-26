"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { userPreferencesInputSchema } from "@/lib/user-preferences-schema";
import type { UserPreferences, UserPreferencesInput } from "@/types/user-preferences";

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getUserPreferences] DB error:", error.message);
    return null;
  }

  return data as UserPreferences | null;
}

export async function updateUserPreferences(
  input: UserPreferencesInput,
): Promise<{ ok: boolean; error?: string; data?: UserPreferences }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const limit = await checkLimit(rl.preferences, user.id);
  if (!limit.allowed) return { ok: false, error: limit.error };

  const parsed = userPreferencesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, ...parsed.data },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[updateUserPreferences] DB error:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as UserPreferences };
}
