"use server";

// Nota: "use server" files solo pueden exportar async functions.
// Schemas/types se importan localmente y los consumidores deben importarlos
// desde "@/lib/tournament-schema" directamente.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { createTournamentSchema } from "./tournament-schema";
import type { CreateTournamentInput } from "./tournament-schema";
import { generateInitialPairings } from "./tournament-formats-engine";

/** Schema legado — no se usa en producción, solo mantiene el contrato de tipos */
const CreateSchemaLegacy = z.object({
  name: z.string().min(2).max(80),
  visibility: z.enum(["public", "private", "friends"]).default("private"),
  modality: z.enum(["ven", "dom", "cub", "pri", "custom"]).default("dom"),
  format: z
    .enum(["rotation", "round_robin", "swiss", "single_elim", "double_elim", "points_league"])
    .default("rotation"),
  points_to_win: z.number().int().min(50).max(500),
  rounds: z.number().int().min(0).max(200).default(0),
  continuous: z.boolean().default(false),
  rated: z.boolean().default(true),
  player_ids: z.array(z.string().uuid()).min(4).max(64),
});

// ─── Helpers ────────────────────────────────────────────────

/** Genera un código alfanumérico de 6 caracteres */
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Devuelve user_a_id < user_b_id para satisfacer el CHECK del schema */
function canonicalPair(a: string, b: string): { user_a_id: string; user_b_id: string } {
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}

// ─── Server actions ──────────────────────────────────────────

/**
 * Crear torneo desde el wizard de 3 pasos (F1.4).
 *
 * Cambios versus el wizard viejo:
 *  - Status inicial: 'in_progress' (skip 'open') — el casual host empieza a jugar inmediatamente.
 *  - `inscription_mode` se deriva del `format` (continuous_league → 'continuous_league',
 *    el resto → 'pre_formed').
 *  - Acepta `player_count` (wizard nuevo) o `max_players` (legacy). El que esté presente
 *    determina el cupo; ambos terminan escritos a `tournaments.max_players`.
 *  - Para formatos pre_formed (Swiss / Round Robin / Single Elim): genera pairings
 *    iniciales (ronda 1) inmediatamente. F1.6 puede refinar la lógica.
 *  - Para continuous_league: NO genera pairings (las partidas se crean per-match
 *    desde el home page).
 *  - Si visibility === 'code': genera un join_code de 6 dígitos.
 *  - Inserta participantes (organizer auto-incluido).
 *  - Si hay pre_formed_pairs (input legacy): inserta en tournament_pairs canonical order.
 */
export async function createTournament(input: CreateTournamentInput) {
  const parsed = createTournamentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const f = parsed.data;

  // Derivar inscription_mode del format si no viene explícito (wizard nuevo).
  // El wizard viejo lo enviaba explícito; aún se respeta si está presente y es válido.
  const inscriptionMode: "pre_formed" | "individual_manual" | "continuous_league" =
    f.inscription_mode ??
    (f.format === "continuous_league" ? "continuous_league" : "pre_formed");

  // Cross-field guard: format='continuous_league' iff inscription_mode='continuous_league'.
  // Auto-corrige el caso de llamadas legacy con inscription_mode incoherente.
  const isContinuousLeagueFormat = f.format === "continuous_league";
  const isContinuousLeagueInscription = inscriptionMode === "continuous_league";
  let finalInscriptionMode = inscriptionMode;
  if (isContinuousLeagueFormat && !isContinuousLeagueInscription) {
    finalInscriptionMode = "continuous_league";
  } else if (!isContinuousLeagueFormat && isContinuousLeagueInscription) {
    return {
      ok: false as const,
      error: "inscription_mode='continuous_league' sólo es válido para format='continuous_league'.",
    };
  }

  // Resolver player_count vs max_players (uno de los dos es requerido — validado por schema).
  const maxPlayers = (f.player_count ?? f.max_players) as number;

  // Validación cross-field básica (F1.5 implementará la función completa).
  // Aquí solo lo mínimo para no romper invariantes de DB.
  if (f.format === "round_robin" && maxPlayers % 2 !== 0) {
    return { ok: false as const, error: "Round Robin de parejas requiere número par de jugadores." };
  }
  if (f.format === "single_elim") {
    const validPow2 = [4, 8, 16, 32, 64];
    if (!validPow2.includes(maxPlayers)) {
      return {
        ok: false as const,
        error: "Eliminación directa requiere 4, 8, 16, 32 o 64 jugadores.",
      };
    }
  }
  if (f.format === "continuous_league" && ![4, 8].includes(maxPlayers)) {
    return { ok: false as const, error: "Liga continua soporta solo 4 u 8 jugadores." };
  }
  if (f.format === "swiss" && maxPlayers < 4) {
    return { ok: false as const, error: "Suizo requiere al menos 4 jugadores." };
  }

  // Validación: participants_ids debería cubrir player_count - 1 (organizer auto-incluido)
  // O exactamente player_count si participant_ids ya incluye al organizer.
  // Solo válida si el caller usó el shape nuevo con `player_count`.
  if (f.player_count != null) {
    const providedCount = f.participant_ids?.length ?? 0;
    // Caso típico del wizard nuevo: participant_ids NO incluye organizer (se agrega abajo).
    // Aceptamos +/-1 para tolerancia (organizer pudo estar incluido o no).
    if (providedCount !== f.player_count && providedCount !== f.player_count - 1) {
      return {
        ok: false as const,
        error: `Cantidad de participantes (${providedCount}) no coincide con el cupo (${f.player_count}).`,
      };
    }
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const limit = await checkLimit(rl.tournament, `tournament:${user.id}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Generar código si la visibilidad es 'code'
  let joinCode: string | null = null;
  if (f.visibility === "code") {
    joinCode = f.join_code ?? generateJoinCode();
  }

  // Calcular points_to_win según modalidad
  const GOALS: Record<string, number> = { ven: 100, dom: 200, cub: 200, pri: 200 };
  const pointsToWin = f.modality === "custom" ? (f.custom_goal ?? 100) : (GOALS[f.modality] ?? 100);

  // Status inicial: el wizard nuevo (3 pasos) salta directo a 'in_progress'.
  // Los callers legacy del wizard viejo pueden necesitar 'open' aún; detectamos
  // por la presencia de `player_count` (wizard nuevo) vs ausencia (legacy).
  const initialStatus: "open" | "in_progress" =
    f.player_count != null ? "in_progress" : "open";

  const insertPayload: Record<string, unknown> = {
    name: f.name,
    visibility: f.visibility,
    modality: f.modality,
    format: f.format,
    points_to_win: pointsToWin,
    status: initialStatus,
    created_by: user.id,
    inscription_mode: finalInscriptionMode,
    time_limit_minutes: f.time_limit_minutes,
    join_code: joinCode,
    description: f.description ?? null,
    max_players: maxPlayers,
    num_boards: f.num_boards ?? 1,
    rated: f.rated ?? true,
    requires_attestation: f.requires_attestation ?? true,
    is_open_ended: f.is_open_ended ?? false,
  };

  const { data: t, error } = await supabase
    .from("tournaments")
    .insert(insertPayload as never)
    .select("id")
    .single();

  if (error || !t) {
    return { ok: false as const, error: error?.message ?? "No se pudo crear el torneo" };
  }

  const tournamentId = t.id as string;

  // Armar la lista completa de participantes (creator siempre incluido)
  const allIndividualIds = Array.from(
    new Set([
      user.id,
      ...(f.participant_ids ?? []),
      ...(f.pre_formed_pairs ?? []).flatMap(({ user_a, user_b }) => [user_a, user_b]),
    ]),
  );

  const playerRows = allIndividualIds.map((pid) => ({
    tournament_id: tournamentId,
    user_id: pid,
  }));

  const { error: pErr } = await supabase.from("tournament_players").insert(playerRows);
  if (pErr) {
    // Rollback: eliminar el torneo recién creado
    await supabase.from("tournaments").delete().eq("id", tournamentId);
    return { ok: false as const, error: pErr.message };
  }

  // Insertar parejas pre-formadas si las hay (input legacy del wizard viejo)
  if (f.pre_formed_pairs && f.pre_formed_pairs.length > 0) {
    const pairRows = f.pre_formed_pairs.map(({ user_a, user_b }) => ({
      tournament_id: tournamentId,
      ...canonicalPair(user_a, user_b),
    }));

    const { error: prErr } = await supabase.from("tournament_pairs").insert(pairRows);
    if (prErr) {
      // No rollback completo aquí; los players ya están insertados.
      // El organizer puede corregir parejas desde la página manage.
      console.error("[createTournament] Error inserting pairs:", prErr.message);
    }
  }

  // Generar pairings iniciales para formatos pre_formed (Swiss / RR / Single Elim).
  // continuous_league: NO genera pairings (se crean per-match desde el home page).
  // Solo se ejecuta cuando el wizard nuevo lo solicita (status='in_progress' directo).
  if (initialStatus === "in_progress" && f.format !== "continuous_league") {
    const pairingResult = await generateInitialPairings(tournamentId);
    if (!pairingResult.ok) {
      console.error("[createTournament] Error generando pairings iniciales:", pairingResult.error);
      // No rollback: el torneo existe; el organizer puede generar pairings manualmente
      // desde la página de manage si esto falla.
    }
  }

  revalidatePath("/tournaments");
  return { ok: true as const, tournament_id: tournamentId };
}

/**
 * Actualiza el status de un torneo.
 * Extendido para soportar todos los valores del EPIC: draft | open | in_progress | finished | archived | cancelled.
 */
export async function setTournamentStatus(
  tournamentId: string,
  status: "draft" | "open" | "in_progress" | "finished" | "archived" | "cancelled",
) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  // Solo el organizador puede cambiar el estado
  const { data: t } = await supabase
    .from("tournaments")
    .select("created_by")
    .eq("id", tournamentId)
    .single();

  if (!t || t.created_by !== user.id) {
    return { ok: false as const, error: "Solo el organizador puede cambiar el estado del torneo" };
  }

  const { error } = await supabase
    .from("tournaments")
    .update({
      status,
      finished_at: status === "finished" ? new Date().toISOString() : null,
    })
    .eq("id", tournamentId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true as const };
}

/**
 * Alias legado para compatibilidad con código existente que llama
 * setTournamentStatus con 'active' | 'finished'.
 * @deprecated Usar setTournamentStatus con los nuevos valores.
 */
export async function setTournamentStatusLegacy(tournamentId: string, status: "active" | "finished") {
  const mapped = status === "active" ? "in_progress" : "finished";
  return setTournamentStatus(tournamentId, mapped);
}

/**
 * Iniciar un torneo: cambia status de 'open' → 'in_progress'.
 * Solo el organizador, solo cuando hay suficientes parejas formadas.
 */
export async function startTournament(tournamentId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const { data: t } = await supabase
    .from("tournaments")
    .select("created_by, status, max_players, inscription_mode")
    .eq("id", tournamentId)
    .single();

  if (!t) return { ok: false as const, error: "Torneo no encontrado" };
  if (t.created_by !== user.id) return { ok: false as const, error: "Solo el organizador puede iniciar el torneo" };
  if (t.status !== "open") return { ok: false as const, error: "El torneo no está en estado 'open'" };

  const { count: playerCount } = await supabase
    .from("tournament_players")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  // Polla: roster lleno, no requiere parejas (se forman per partida).
  // Otros formatos: requiere parejas pre-formadas.
  if (t.inscription_mode === "continuous_league") {
    if ((playerCount ?? 0) !== t.max_players) {
      return {
        ok: false as const,
        error: `Faltan ${t.max_players - (playerCount ?? 0)} jugadores`,
      };
    }
  } else {
    const { count: pairCount } = await supabase
      .from("tournament_pairs")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    const expectedPairs = Math.floor((playerCount ?? 0) / 2);
    if ((pairCount ?? 0) < expectedPairs) {
      return {
        ok: false as const,
        error: `Faltan parejas: hay ${pairCount} de ${expectedPairs} requeridas`,
      };
    }
  }

  const { error } = await supabase
    .from("tournaments")
    .update({ status: "in_progress" })
    .eq("id", tournamentId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  return { ok: true as const };
}
