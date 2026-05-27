"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";

// ============================================================
// createNewMatchInPolla — crea pairing + match en una polla
// ============================================================

const NewMatchSchema = z.object({
  tournament_id: z.string().uuid(),
  team_a:        z.array(z.string().uuid()).length(2),
  team_b:        z.array(z.string().uuid()).length(2),
});

export type NewMatchInput = z.infer<typeof NewMatchSchema>;

export async function createNewMatchInPolla(
  input: NewMatchInput,
): Promise<{ ok: true; match_id: string } | { ok: false; error: string }> {
  const parsed = NewMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tournament_id, team_a, team_b } = parsed.data;

  const all = [...team_a, ...team_b];
  if (new Set(all).size !== 4) {
    return { ok: false, error: "Los 4 jugadores deben ser distintos." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const limit = await checkLimit(rl.matchStart, `polla-match:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  // 1. Cargar torneo: validar que es polla open y current_season
  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, format, status, current_season, modality, points_to_win, rated")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.status !== "open" && t.status !== "in_progress") {
    return { ok: false, error: "La polla está cerrada." };
  }

  // 2. Validar que los 4 players están en el roster
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournament_id);
  const rosterIds = new Set((players ?? []).map((p) => p.user_id));
  for (const id of all) {
    if (!rosterIds.has(id)) {
      return { ok: false, error: "Hay un jugador que no pertenece a la polla." };
    }
  }

  // 3. Validar que el caller está en el roster
  if (!rosterIds.has(user.id)) {
    return { ok: false, error: "No sos parte de esta polla." };
  }

  // 4. Insertar match (format='doubles', NO 'polla')
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      format:        "doubles",
      set_size:      "d6",
      modality:      t.modality,
      target_points: t.points_to_win,
      capicua_bonus: 30,
      status:        "in_progress",
      created_by:    user.id,
      tournament_id: tournament_id,
      // rated: hereda explícitamente del torneo (defensive — PR #10 también
      // lo haría vía aplicación del flag desde tournaments.rated en applyMatchRating).
      rated:         t.rated,
    })
    .select("id")
    .single();
  if (mErr || !match) return { ok: false, error: mErr?.message ?? "No se pudo crear la partida." };

  // 5. Insertar match_players
  const mpRows = [
    ...team_a.map((uid) => ({ match_id: match.id, user_id: uid, team: 1, score: 0 })),
    ...team_b.map((uid) => ({ match_id: match.id, user_id: uid, team: 2, score: 0 })),
  ];
  const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
  if (mpErr) {
    await supabase.from("matches").delete().eq("id", match.id);
    return { ok: false, error: mpErr.message };
  }

  // 6. Insertar pairing con season = current_season
  //    IMPORTANTE: la constraint UNIQUE (tournament_id, round, board) requiere
  //    que board sea único por (tournament_id, round). Usamos round=0 (polla no
  //    tiene rondas) y board = count_de_pairings_existentes + 1 para evitar
  //    conflictos al crear múltiples partidas en la misma polla.
  const { count: existingCount } = await supabase
    .from("tournament_pairings")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament_id)
    .eq("round", 0);

  const board = (existingCount ?? 0) + 1;

  const { error: prErr } = await supabase
    .from("tournament_pairings")
    .insert({
      tournament_id:   tournament_id,
      round:           0,  // legacy column, no se usa en polla
      board:           board,
      team_a_user_ids: team_a,
      team_b_user_ids: team_b,
      match_id:        match.id,
      season:          t.current_season,
    });
  if (prErr) {
    console.error("[createNewMatchInPolla] pairing insert failed:", prErr);
    // Match queda creado pero sin pairing. Reportable pero no bloqueante.
  }

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true, match_id: match.id };
}

// ============================================================
// startNewSeason — incrementa current_season
// ============================================================

const NewSeasonSchema = z.object({
  tournament_id: z.string().uuid(),
  confirm_name:  z.string(),
});

export async function startNewSeason(
  input: z.infer<typeof NewSeasonSchema>,
): Promise<{ ok: true; new_season: number } | { ok: false; error: string }> {
  const parsed = NewSeasonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tournament_id, confirm_name } = parsed.data;

  if (confirm_name.trim().toLowerCase() !== "nueva temporada") {
    return { ok: false, error: "Escribí exactamente 'nueva temporada' para confirmar." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, created_by, current_season, format")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.created_by !== user.id) return { ok: false, error: "Solo el organizador puede empezar una temporada." };

  const newSeason = t.current_season + 1;
  const { error: uErr } = await supabase
    .from("tournaments")
    .update({ current_season: newSeason })
    .eq("id", tournament_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true, new_season: newSeason };
}

// ============================================================
// closePolla — marca status='finished'
// ============================================================

export async function closePolla(
  tournament_id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(tournament_id).success) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, created_by, format, status")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.created_by !== user.id) return { ok: false, error: "Solo el organizador puede cerrar la polla." };
  if (t.status === "finished") return { ok: true };  // idempotente

  const { error: uErr } = await supabase
    .from("tournaments")
    .update({ status: "finished" })
    .eq("id", tournament_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true };
}
