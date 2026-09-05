"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function voidMatch(matchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("void_match", { p_match_id: matchId });

  if (error) {
    const msg =
      error.message.includes("not_authorized") ? "Solo el creador puede anular esta partida" :
      error.message.includes("not_voidable")   ? "Esta partida no se puede anular" :
      error.message.includes("match_not_found") ? "Partida no encontrada" :
      "Error al anular la partida";
    return { ok: false, error: msg };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true };
}
