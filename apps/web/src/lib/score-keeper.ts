"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type TransferResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Transfiere el rol de score-keeper a otro player del match.
 * Solo el current keeper puede llamar (RPC enforce ese check).
 * Spec C5.
 */
export async function transferScoreKeeper(
  matchId: string,
  newKeeperUserId: string,
): Promise<TransferResult> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase.rpc("transfer_score_keeper", {
    p_match_id: matchId,
    p_new_keeper_user_id: newKeeperUserId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/matches/${matchId}/live`);
  return { ok: true };
}
