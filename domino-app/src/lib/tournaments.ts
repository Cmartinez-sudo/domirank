"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const CreateSchema = z.object({
  name: z.string().min(2).max(80),
  visibility: z.enum(["public", "private", "friends"]).default("private"),
  modality: z.enum(["ven", "dom", "cub", "pri", "custom"]).default("dom"),
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

  // Crear el tournament
  const { data: t, error } = await supabase
    .from("tournaments")
    .insert({
      name: f.name,
      visibility: f.visibility,
      modality: f.modality,
      points_to_win: f.points_to_win,
      rounds: f.rounds,
      continuous: f.continuous,
      rated: f.rated,
      status: "active",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !t) return { ok: false as const, error: error?.message ?? "No se pudo crear la polla" };

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
