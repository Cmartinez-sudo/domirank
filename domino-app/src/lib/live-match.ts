"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { validateMatchClosure } from "@/lib/match-validation";

/* ============================================================
   START LIVE MATCH
   ============================================================ */

const StartSchema = z.object({
  modality: z.enum(["ven","dom","cub","pri","custom"]),
  format: z.enum(["singles","doubles"]),
  set_size: z.enum(["d6","d9"]),
  target_points: z.number().int().min(50).max(500),
  capicua_bonus: z.number().int().min(0).max(100),
  team_a_players: z.array(z.string().uuid()).min(1).max(2),
  team_b_players: z.array(z.string().uuid()).min(1).max(2),
  tournament_id: z.string().uuid().nullable().optional(),
});
export type StartLiveMatchInput = z.infer<typeof StartSchema>;

export async function startLiveMatch(input: StartLiveMatchInput): Promise<{ ok: true; match_id: string } | { ok: false; error: string }> {
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const i = parsed.data;

  const expectedSize = i.format === "singles" ? 1 : 2;
  if (i.team_a_players.length !== expectedSize || i.team_b_players.length !== expectedSize) {
    return { ok: false, error: `En ${i.format} cada equipo debe tener ${expectedSize} jugador(es).` };
  }
  const all = [...i.team_a_players, ...i.team_b_players];
  if (new Set(all).size !== all.length) return { ok: false, error: "Un jugador no puede estar en dos equipos." };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const limit = await checkLimit(rl.matchStart, `match:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  // Epic Q: ya no validamos amistad. Cualquier jugador puede agregarse.
  // La confianza viene del attestation system (3 de 4 firmas).

  // Si ya hay una partida in_progress del usuario, cancelarla primero
  await supabase.from("matches").update({ status: "cancelled" }).eq("created_by", user.id).eq("status", "in_progress");

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      format: i.format,
      set_size: i.set_size,
      modality: i.modality,
      target_points: i.target_points,
      capicua_bonus: i.capicua_bonus,
      status: "in_progress",
      rated: true,
      created_by: user.id,
      tournament_id: i.tournament_id ?? null,
    })
    .select("id")
    .single();

  if (mErr || !match) return { ok: false, error: mErr?.message ?? "No se pudo crear la partida" };

  // Insertar match_players con team y score 0 (los snapshots de rating se llenan al finalizar)
  const mpRows = [
    ...i.team_a_players.map((pid) => ({ match_id: match.id, user_id: pid, team: 1, score: 0 })),
    ...i.team_b_players.map((pid) => ({ match_id: match.id, user_id: pid, team: 2, score: 0 })),
  ];
  const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
  if (mpErr) {
    await supabase.from("matches").delete().eq("id", match.id);
    return { ok: false, error: mpErr.message };
  }
  return { ok: true, match_id: match.id };
}

/* ============================================================
   ADD ROUND (sumar puntos a un equipo)
   ============================================================ */

const AddRoundSchema = z.object({
  match_id: z.string().uuid(),
  team: z.number().int().min(1).max(2),
  points: z.number().int().min(1).max(999),
  kind: z.enum(["points","capicua","tranque"]).default("points"),
});

export async function addRound(input: z.infer<typeof AddRoundSchema>) {
  const parsed = AddRoundSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message };
  const { match_id, team, points, kind } = parsed.data;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado." };

  // Determinar siguiente round_number
  const { data: existing } = await supabase
    .from("match_rounds")
    .select("round_number")
    .eq("match_id", match_id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const round_number = (existing?.round_number ?? 0) + 1;

  const { error } = await supabase.from("match_rounds").insert({
    match_id, round_number, team, points, kind, created_by: user.id,
  });
  if (error) return { ok: false as const, error: error.message };

  // Actualizar score acumulado en match_players (denormalización para queries rápidas)
  await syncMatchScores(match_id);
  revalidatePath(`/matches/${match_id}/live`);
  return { ok: true as const };
}

export async function undoLastRound(match_id: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado." };

  const { data: last } = await supabase
    .from("match_rounds")
    .select("id")
    .eq("match_id", match_id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { ok: true as const };
  const { error } = await supabase.from("match_rounds").delete().eq("id", last.id);
  if (error) return { ok: false as const, error: error.message };
  await syncMatchScores(match_id);
  revalidatePath(`/matches/${match_id}/live`);
  return { ok: true as const };
}

export async function cancelLiveMatch(match_id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", match_id);
  if (error) return { ok: false as const, error: error.message };
  redirect("/dashboard");
}

/* ============================================================
   FINALIZE — aplica OpenSkill al ganador y persiste ratings
   ============================================================ */

/**
 * Finaliza una partida → la mueve a `pending_attestation`.
 *
 * Arquitectura (Epic Q):
 *   - El cálculo de OpenSkill NO se aplica aquí. Esperamos consenso
 *     (3 de 4 jugadores firmando) antes de afectar el rating.
 *   - El SQL RPC `finalize_match` cambia status, marca al scorekeeper
 *     y auto-firma su attestation.
 *   - Si después se llega a quórum vía attestMatch, ahí se aplica el
 *     rating. Ver src/lib/match-attest-actions.ts.
 */
export async function finalizeMatch(match_id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Sincronizar scores acumulados desde los rounds antes de finalizar
  await syncMatchScores(match_id);

  // Validar que haya ganador definido (no empates).
  // IMPORTANT: en doubles hay varias filas por equipo con el mismo score denormalizado.
  // Usar MAX por equipo, no SUM, para evitar doblar el score.
  const { data: mps } = await supabase
    .from("match_players")
    .select("team, score")
    .eq("match_id", match_id);
  if (!mps || mps.length === 0) return { ok: false, error: "Sin jugadores." };
  const teamScores: Record<number, number> = {};
  for (const r of mps) {
    teamScores[r.team] = Math.max(teamScores[r.team] ?? 0, r.score);
  }
  const { data: matchRow } = await supabase
    .from("matches")
    .select("target_points")
    .eq("id", match_id)
    .single();
  if (!matchRow) return { ok: false, error: "Partida no encontrada." };
  const validation = validateMatchClosure(
    teamScores[1] ?? 0,
    teamScores[2] ?? 0,
    matchRow.target_points,
  );
  if (validation.status === 'in_progress') {
    return { ok: false, error: "Ningún equipo ha llegado a la meta aún." };
  }
  if (validation.status === 'tied_at_goal') {
    return { ok: false, error: "Empate — deben jugar una mano adicional para desempatar." };
  }

  // Llamar SQL RPC: mueve a pending_attestation + auto-attest scorekeeper
  const { error: rpcErr } = await supabase.rpc("finalize_match", { p_match_id: match_id });
  if (rpcErr) {
    const m = rpcErr.message ?? "";
    const friendly =
      m.includes("not_authorized")    ? "Solo el creador puede finalizar" :
      m.includes("not_finalizable")   ? "La partida ya no está en curso" :
      m.includes("match_not_found")   ? "Partida no encontrada" :
      "Error al finalizar la partida";
    console.error("finalize_match RPC failed:", rpcErr);
    return { ok: false, error: friendly };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/matches/${match_id}`);
  return { ok: true };
}

/* ============================================================
   HELPERS
   ============================================================ */

async function syncMatchScores(match_id: string) {
  const supabase = await supabaseServer();
  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", match_id);
  const scores: Record<number, number> = {};
  for (const r of rounds ?? []) scores[r.team] = (scores[r.team] ?? 0) + r.points;
  for (const [team, score] of Object.entries(scores)) {
    await supabase
      .from("match_players")
      .update({ score })
      .eq("match_id", match_id)
      .eq("team", Number(team));
  }
}
