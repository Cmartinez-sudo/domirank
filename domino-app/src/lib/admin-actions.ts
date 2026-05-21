"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function adminResolveMatch(
  matchId: string,
  resolution: "confirm" | "void"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("admin_resolve_match", {
    p_match_id: matchId,
    p_resolution: resolution,
  });

  if (error) {
    const m = error.message ?? "";
    const friendly =
      m.includes("not_admin")        ? "No autorizado" :
      m.includes("not_resolvable")   ? "Esta partida ya no se puede resolver" :
      m.includes("match_not_found")  ? "Partida no encontrada" :
      "Error al resolver";
    return { ok: false, error: friendly };
  }

  revalidatePath("/admin/disputes");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}
