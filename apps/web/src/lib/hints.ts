"use server";

// Sprint 1c: server actions para el sistema minimal de hints.
// El estado (hints_seen jsonb) vive en profiles y se lee server-side una vez;
// el componente cliente Hint chequea con un context/prop `seenIds` provisto
// desde el layout.

import { supabaseServer } from "@/lib/supabase/server";

export async function markHintSeen(hintId: string): Promise<{ ok: true; seenIds: string[] } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("mark_hint_seen", { p_hint_id: hintId } as never);
  if (error) return { ok: false, error: error.message };

  const seenIds = Array.isArray(data) ? (data as string[]) : [];
  return { ok: true, seenIds };
}

export async function loadHintsSeen(): Promise<string[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("profiles")
    .select("hints_seen")
    .eq("id", user.id)
    .maybeSingle();

  const raw = (data?.hints_seen as unknown) ?? [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string") as string[];
  return [];
}
