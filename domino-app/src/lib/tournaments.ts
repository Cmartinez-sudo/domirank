"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";

const CreateSchema = z.object({
  name: z.string().min(2).max(80),
  visibility: z.enum(["public", "private", "friends"]).default("private"),
  modality: z.enum(["ven", "dom", "cub", "pri", "custom"]).default("dom"),
  format: z.enum(["rotation", "round_robin", "swiss", "single_elim", "double_elim", "points_league"]).default("rotation"),
  points_to_win: z.number().int().min(50).max(500),
  rounds: z.number().int().min(0).max(200).default(0),
  continuous: z.boolean().default(false),
  rated: z.boolean().default(true),
  player_ids: z.array(z.string().uuid()).min(4).max(64),
});

export async function createTournament(input: z.infer<typeof CreateSchema>) {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const f = parsed.data;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const limit = await checkLimit(rl.tournament, `tournament:${user.id}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Validar que todos los participantes (excepto el creador) sean amigos
  const otherIds = f.player_ids.filter((id) => id !== user.id);
  if (otherIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .in("friend_id", otherIds);
    const friendSet = new Set((friendRows ?? []).map((r) => r.friend_id));
    const notFriends = otherIds.filter((id) => !friendSet.has(id));
    if (notFriends.length > 0) {
      return { ok: false as const, error: "Solo puedes agregar amigos al torneo. Envíales solicitud primero." };
    }
  }

  // Crear el tournament
  const { data: t, error } = await supabase
    .from("tournaments")
    .insert({
      name: f.name,
      visibility: f.visibility,
      modality: f.modality,
      format: f.format,
      points_to_win: f.points_to_win,
      rounds: f.rounds,
      continuous: f.continuous,
      rated: f.rated,
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !t) return { ok: false as const, error: error?.message ?? "No se pudo crear el torneo" };

  // Insertar jugadores (asegurando que el creador esté incluido)
  const playerIds = Array.from(new Set([user.id, ...f.player_ids]));
  const rows = playerIds.map((pid) => ({ tournament_id: t.id, user_id: pid }));
  const { error: pErr } = await supabase.from("tournament_players").insert(rows);
  if (pErr) {
    await supabase.from("tournaments").delete().eq("id", t.id);
    return { ok: false as const, error: pErr.message };
  }
  revalidatePath("/tournaments");
  return { ok: true as const, tournament_id: t.id };
}

export async function setTournamentStatus(tournamentId: string, status: "active" | "finished") {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("tournaments")
    .update({ status, finished_at: status === "finished" ? new Date().toISOString() : null })
    .eq("id", tournamentId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true as const };
}
