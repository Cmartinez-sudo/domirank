"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type EditCheck =
  | { allowed: true; reason: "author_within_window" | "host_override" }
  | { allowed: false; reason: "requires_attestation" | "match_not_in_progress" | "round_not_found" | "match_not_found" | "not_authenticated" };

/**
 * Server-side check used by EditHandModal to decide which UI flow to
 * render (direct edit vs propose correction).
 */
export async function checkEditHandPermission(roundId: number): Promise<EditCheck> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, reason: "not_authenticated" };

  const { data, error } = await supabase
    .rpc("can_edit_hand", { p_round_id: roundId, p_user_id: user.id });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { allowed: false, reason: "round_not_found" };
  }
  const row = data[0] as { allowed: boolean; reason: string };
  return {
    allowed: row.allowed,
    reason: row.reason as EditCheck["reason"],
  } as EditCheck;
}

/**
 * Author-within-window OR host edits — applies directly via UPDATE.
 * RLS policy `match_rounds_update_authorized` enforces the same check
 * server-side.
 */
export async function editHandDirect(
  matchId: string,
  roundId: number,
  patch: { team: number; points: number; kind: "points" | "capicua" | "tranque" },
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado." };

  const { error } = await supabase
    .from("match_rounds")
    .update({
      team: patch.team,
      points: patch.points,
      kind: patch.kind,
      last_edited_by_user_id: user.id,
      last_edited_at: new Date().toISOString(),
      edit_count: undefined, // postgres handles increment via trigger? Will add via RPC if needed.
    })
    .eq("id", roundId);

  if (error) return { ok: false as const, error: error.message };

  // Increment edit_count atomically via RPC.
  try {
    await supabase.rpc("increment_edit_count", { p_round_id: roundId });
  } catch {
    // Non-fatal; the UPDATE above already stamped last_edited_*.
  }

  revalidatePath(`/matches/${matchId}/live`);
  return { ok: true as const };
}

/**
 * Otros casos: dispara la proposal flow (RPC propose_hand_edit).
 */
export async function proposeHandEdit(
  matchId: string,
  roundId: number,
  patch: { team: number; points: number; kind: "points" | "capicua" | "tranque" },
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado." };

  const { data, error } = await supabase.rpc("propose_hand_edit", {
    p_round_id: roundId,
    p_new_team: patch.team,
    p_new_points: patch.points,
    p_new_kind: patch.kind,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/matches/${matchId}/live`);
  return { ok: true as const, proposalId: data as string };
}

export async function confirmHandEdit(matchId: string, proposalId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("confirm_hand_edit", { p_proposal_id: proposalId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/matches/${matchId}/live`);
  return { ok: true as const, status: data as string };
}

export async function rejectHandEdit(matchId: string, proposalId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("reject_hand_edit", { p_proposal_id: proposalId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/matches/${matchId}/live`);
  return { ok: true as const, status: data as string };
}
