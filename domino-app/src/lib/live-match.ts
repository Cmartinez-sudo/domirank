"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { updateRatings, type TeamInput } from "@/lib/rating";
import { MODALIDADES, modalityByCode, type ModalityCode, type SetCode, type FormatCode } from "@/lib/modalidades";
import { rl, checkLimit } from "@/lib/ratelimit";

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

  // Validar que TODOS los otros jugadores sean amigos del creador.
  // Defensa en profundidad: el UI solo permite amigos pero un cliente malicioso
  // podría llamar este action directamente.
  const otherIds = [...i.team_a_players, ...i.team_b_players].filter((id) => id !== user.id);
  if (otherIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .in("friend_id", otherIds);
    const friendSet = new Set((friendRows ?? []).map((r) => r.friend_id));
    const notFriends = otherIds.filter((id) => !friendSet.has(id));
    if (notFriends.length > 0) {
      return { ok: false, error: "Solo puedes jugar con tus amigos. Envía solicitud antes de invitar." };
    }
  }

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
 * Finaliza una partida y aplica el cálculo de OpenSkill.
 *
 * Arquitectura: la matemática (Plackett-Luce / Weng-Lin) corre en JS porque
 * vive en la librería `openskill`, pero la persistencia (snapshots de
 * match_players + bump de profile ratings + status=completed) se hace
 * atómicamente vía la función SQL `finalize_match(p_match_id, p_updates)`
 * — un único bloque PL/pgSQL con `for update` lock sobre la partida.
 * Esto previene doble-finalize, partial-failures, y race conditions
 * en el path de mutación. Ver migración 0012.
 */
export async function finalizeMatch(match_id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Pre-check liviano (SQL re-verifica todo bajo lock)
  const { data: match } = await supabase
    .from("matches")
    .select("id, created_by, status, format, set_size")
    .eq("id", match_id)
    .single();
  if (!match) return { ok: false, error: "No existe la partida." };
  if (match.created_by !== user.id) return { ok: false, error: "Solo el creador puede finalizar." };
  if (match.status !== "in_progress") return { ok: false, error: "La partida no está en curso." };

  await syncMatchScores(match_id);

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team, score")
    .eq("match_id", match_id);
  if (!mps || mps.length === 0) return { ok: false, error: "Sin jugadores." };

  // Detectar ganador / validar empate
  const teamScores: Record<number, number> = {};
  for (const r of mps) teamScores[r.team] = (teamScores[r.team] ?? 0) + r.score;
  const max = Math.max(...Object.values(teamScores));
  const winners = Object.entries(teamScores).filter(([, s]) => s === max).map(([t]) => Number(t));
  if (winners.length !== 1) return { ok: false, error: "Empates no se rankean." };

  // Cargar μ/σ actuales para el bucket correspondiente
  const mu_col    = ratingCol(match.set_size as SetCode, match.format as FormatCode, "mu");
  const sigma_col = ratingCol(match.set_size as SetCode, match.format as FormatCode, "sigma");
  const userIds   = mps.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(`id, ${mu_col}, ${sigma_col}`)
    .in("id", userIds);
  if (pErr || !profiles) return { ok: false, error: pErr?.message ?? "No se pudieron leer perfiles" };
  const byId = new Map(profiles.map((p: any) => [p.id, p]));

  // Construir teams para OpenSkill (rank 1 = mejor)
  const teamsMap = new Map<number, typeof mps>();
  for (const r of mps) {
    if (!teamsMap.has(r.team)) teamsMap.set(r.team, []);
    teamsMap.get(r.team)!.push(r);
  }
  const teamInputs: TeamInput[] = Array.from(teamsMap.entries()).sort(([a],[b]) => a - b).map(([team, rows]) => ({
    team,
    rank: 1 + Object.values(teamScores).filter((s) => s > teamScores[team]).length,
    players: rows.map((r) => {
      const p: any = byId.get(r.user_id);
      return { user_id: r.user_id, mu: Number(p[mu_col]), sigma: Number(p[sigma_col]) };
    }),
  }));

  const updates = updateRatings(teamInputs);

  // Aplicar atómicamente vía RPC
  const { error: rpcErr } = await supabase.rpc("finalize_match", {
    p_match_id: match_id,
    p_updates: updates.map((u) => ({
      user_id:      u.user_id,
      rank:         u.rank,
      mu_before:    u.mu_before,
      sigma_before: u.sigma_before,
      mu_after:     u.mu_after,
      sigma_after:  u.sigma_after,
    })),
  });

  if (rpcErr) {
    const m = rpcErr.message ?? "";
    const friendly =
      m.includes("not_authorized")        ? "Solo el creador puede finalizar" :
      m.includes("not_finalizable")       ? "La partida ya no está en curso" :
      m.includes("match_not_found")       ? "Partida no encontrada" :
      m.includes("user_not_in_match")     ? "Datos inconsistentes — recarga la página" :
      m.includes("updates_count_mismatch")? "Conteo de jugadores inconsistente" :
      m.includes("invalid_update_fields") ? "Datos inválidos en el cálculo de rating" :
      "Error al finalizar la partida";
    console.error("finalize_match RPC failed:", rpcErr);
    return { ok: false, error: friendly };
  }

  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath(`/matches/${match_id}`);
  return { ok: true };
}

/* ============================================================
   HELPERS
   ============================================================ */

function ratingCol(set: SetCode, format: FormatCode, suffix: "mu"|"sigma"|"games"|"wins"|"losses"): string {
  // d6 usa columnas legacy singles_*/doubles_*; d9 usa d9_singles_*/d9_doubles_*
  const base = set === "d6"
    ? (format === "singles" ? "singles" : "doubles")
    : (format === "singles" ? "d9_singles" : "d9_doubles");
  return `${base}_${suffix}`;
}

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
