"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";

// ============================================================
// createNewMatchInContinuousLeague — crea pairing + match en una polla
// ============================================================

const NewMatchSchema = z.object({
  tournament_id: z.string().uuid(),
  team_a:        z.array(z.string().uuid()).length(2),
  team_b:        z.array(z.string().uuid()).length(2),
});

export type NewMatchInput = z.infer<typeof NewMatchSchema>;

export async function createNewMatchInContinuousLeague(
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

  const limit = await checkLimit(rl.matchStart, `continuous-league-match:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  // 1. Cargar torneo: validar que es polla open y current_season
  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, format, status, current_season, modality, points_to_win, rated")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "continuous_league") return { ok: false, error: "Este torneo no es una polla." };
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
    return { ok: false, error: "No eres parte de esta polla." };
  }

  // 3.5. Resolver orphan in_progress matches del caller
  //
  // Constraint matches_one_inprogress_per_user: 1 sola partida in_progress
  // por created_by. Si hay un orphan, el insert siguiente falla con
  // "duplicate key violates unique constraint" — bug reportado en sesión
  // 2026-05-29.
  //
  // Estrategia:
  //   - Mismo polla: avisar al usuario que ya hay una activa (la matches
  //     list ya debería ofrecerle "Continuar partida en curso" via bigbtn)
  //   - Quick match orphan (sin tournament_id): auto-cancel — mismo
  //     comportamiento que startLiveMatch (live-match.ts:56)
  //   - Orphan de OTRO torneo: error claro con el nombre
  const { data: orphan } = await supabase
    .from("matches")
    .select("id, tournament_id, tournaments(name)")
    .eq("created_by", user.id)
    .eq("status", "in_progress")
    .maybeSingle();
  if (orphan) {
    if (orphan.tournament_id === tournament_id) {
      return {
        ok: false,
        error: "Ya tienes una partida en curso en esta polla. Continúala primero.",
      };
    }
    if (!orphan.tournament_id) {
      // Quick match abandonado — cancelar
      await supabase.from("matches").update({ status: "cancelled" }).eq("id", orphan.id);
    } else {
      const tName = (orphan as { tournaments?: { name?: string } | { name?: string }[] | null }).tournaments;
      const name = Array.isArray(tName) ? tName[0]?.name : tName?.name;
      return {
        ok: false,
        error: `Tienes una partida en curso en "${name ?? "otro torneo"}". Termínala o abandónala primero.`,
      };
    }
  }

  // 4. Insertar match (format='doubles', NO 'continuous_league')
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
    console.error("[createNewMatchInContinuousLeague] pairing insert failed:", prErr);
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
    return { ok: false, error: "Escribe exactamente 'nueva temporada' para confirmar." };
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
  if (t.format !== "continuous_league") return { ok: false, error: "Este torneo no es una polla." };
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
// reopenContinuousLeagueMatch — revierte confirmed → in_progress (para editar rondas)
// ============================================================
//
// Solo el creator de la partida puede reabrirla. La idea: si hubo error en
// el score, se puede reabrir, borrar/agregar manos, y volver a finalizar.
//
// NOTA: el rating ya aplicado (mu_after/elo_after) NO se revierte. La próxima
// finalización lo sobreescribirá. Esto es deuda técnica menor — si el rating
// queda inconsistente, se puede arreglar con un script offline.

export async function reopenContinuousLeagueMatch(
  match_id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(match_id).success) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: m, error: mErr } = await supabase
    .from("matches")
    .select("id, created_by, status, tournament_id")
    .eq("id", match_id)
    .single();
  if (mErr || !m) return { ok: false, error: "Partida no encontrada." };
  if (m.created_by !== user.id) return { ok: false, error: "Solo el creador puede editar la partida." };
  if (m.status !== "confirmed") return { ok: false, error: "Solo se pueden editar partidas confirmadas." };

  // Validar que es de polla
  if (!m.tournament_id) return { ok: false, error: "Esta partida no pertenece a una polla." };
  const { data: t } = await supabase
    .from("tournaments")
    .select("format")
    .eq("id", m.tournament_id)
    .single();
  if ((t as { format?: string } | null)?.format !== "continuous_league") {
    return { ok: false, error: "Esta partida no es de una polla." };
  }

  // Otra partida in_progress del mismo user bloquea (constraint
  // matches_one_inprogress_per_user). Reportarlo claro.
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("created_by", user.id)
    .eq("status", "in_progress")
    .neq("id", match_id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Ya tienes otra partida en curso. Termínala primero." };
  }

  const { error: uErr } = await supabase
    .from("matches")
    .update({ status: "in_progress", finished_at: null })
    .eq("id", match_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/matches/${match_id}/live`);
  revalidatePath(`/tournaments/${m.tournament_id}`);
  return { ok: true };
}

// ============================================================
// deleteContinuousLeagueMatch — marca status='cancelled' (soft delete)
// ============================================================
//
// La matches list de ContinuousLeagueHomePage filtra por status visible, así que
// 'cancelled' desaparece. No borramos hard porque puede romper FK desde
// tournament_pairings y referencias de rating.

export async function deleteContinuousLeagueMatch(
  match_id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(match_id).success) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: m, error: mErr } = await supabase
    .from("matches")
    .select("id, created_by, status, tournament_id")
    .eq("id", match_id)
    .single();
  if (mErr || !m) return { ok: false, error: "Partida no encontrada." };
  if (m.created_by !== user.id) return { ok: false, error: "Solo el creador puede eliminar la partida." };
  if (!m.tournament_id) return { ok: false, error: "Esta partida no pertenece a una polla." };

  const { data: t } = await supabase
    .from("tournaments")
    .select("format")
    .eq("id", m.tournament_id)
    .single();
  if ((t as { format?: string } | null)?.format !== "continuous_league") {
    return { ok: false, error: "Esta partida no es de una polla." };
  }

  const { error: uErr } = await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", match_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${m.tournament_id}`);
  return { ok: true };
}

// ============================================================
// rematchContinuousLeagueMatch — crea nueva partida con los mismos teams
// ============================================================
//
// Reusa los teams del match anterior. Útil para revancha inmediata.

export async function rematchContinuousLeagueMatch(
  prev_match_id: string,
): Promise<{ ok: true; match_id: string } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(prev_match_id).success) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Cargar match anterior
  const { data: prev, error: pErr } = await supabase
    .from("matches")
    .select("id, tournament_id, status, match_players(user_id, team)")
    .eq("id", prev_match_id)
    .single();
  if (pErr || !prev) return { ok: false, error: "Partida anterior no encontrada." };
  if (!prev.tournament_id) return { ok: false, error: "Esta partida no pertenece a una polla." };

  type MP = { user_id: string; team: number };
  const mps = (prev.match_players ?? []) as MP[];
  const teamA = mps.filter((mp) => mp.team === 1).map((mp) => mp.user_id);
  const teamB = mps.filter((mp) => mp.team === 2).map((mp) => mp.user_id);

  if (teamA.length !== 2 || teamB.length !== 2) {
    return { ok: false, error: "La partida anterior no tiene 2v2 (no se puede repetir)." };
  }

  // Delegamos a createNewMatchInContinuousLeague (incluye validación de roster + rate limit)
  return createNewMatchInContinuousLeague({
    tournament_id: prev.tournament_id,
    team_a:        teamA as [string, string],
    team_b:        teamB as [string, string],
  });
}

// ============================================================
// closeContinuousLeague — marca status='finished'
// ============================================================

export async function closeContinuousLeague(
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
  if (t.format !== "continuous_league") return { ok: false, error: "Este torneo no es una polla." };
  if (t.created_by !== user.id) return { ok: false, error: "Solo el organizador puede cerrar la polla." };
  if (t.status === "finished") return { ok: true };  // idempotente

  // F1.11: validar que TODOS los participantes (excluyendo el organizer)
  // son amigos del organizer antes de cerrar la polla. Esto cierra el loop
  // de F1.10: durante la liga se pudieron agregar no-amigos (si attestation
  // estaba OFF), pero antes de cerrar tienen que estar como amigos del
  // organizer.
  const { data: roster } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(username, display_name)")
    .eq("tournament_id", tournament_id);
  const playerIds = (roster ?? [])
    .map((r) => r.user_id as string)
    .filter((uid) => uid !== user.id);

  if (playerIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .in("friend_id", playerIds);
    const friendIds = new Set((friendRows ?? []).map((r) => r.friend_id as string));
    const nonFriends = (roster ?? [])
      .filter((r) => {
        const uid = r.user_id as string;
        return uid !== user.id && !friendIds.has(uid);
      })
      .map((r) => {
        const prof = r.profiles as { username?: string; display_name?: string | null } | null;
        return prof?.display_name ?? prof?.username ?? "?";
      });

    if (nonFriends.length > 0) {
      const list = nonFriends.join(", ");
      return {
        ok: false,
        error: `Para cerrar la polla, todos los jugadores tienen que ser tus amigos. Agregá como amigos: ${list}.`,
      };
    }
  }

  const { error: uErr } = await supabase
    .from("tournaments")
    .update({ status: "finished" })
    .eq("id", tournament_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true };
}
