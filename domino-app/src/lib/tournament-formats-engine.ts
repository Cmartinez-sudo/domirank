"use server";

// Nota: "use server" files solo pueden exportar async functions.
// Para usar el algoritmo Berger directamente, importá desde "@/lib/berger-schedule".

import { supabaseServer } from "@/lib/supabase/server";
import type { TournamentFormat } from "@/lib/tournament-formats";

// ─── Types (internos, no exportables desde "use server") ───────────────────

type Team = { userIds: string[]; label: string };

type Standing = {
  teamUserIds: string[];
  label: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  score: number; // composite (wins * 3 + pointsFor/1000 tiebreak)
};

// ─── Public actions ──────────────────────────────────────────────────────────

export async function generateInitialPairings(tournamentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    const { data: t } = await supabase
      .from("tournaments")
      .select("*, tournament_players(user_id)")
      .eq("id", tournamentId)
      .eq("created_by", user.id)
      .single();
    if (!t) return { ok: false, error: "Torneo no encontrado" };

    const playerIds: string[] = (t.tournament_players ?? []).map((p: any) => p.user_id);
    const format: TournamentFormat = t.format ?? "rotation";
    const modality = t.modality ?? "ven";
    const numBoards: number = (t as Record<string, unknown>).num_boards as number ?? 1;

    // Opción B: leer tournament_pairs para respetar las parejas ya armadas
    // por el wizard. Si hay pairs definidos, cada par es un team.
    // Si el torneo es 'singles' (1v1) o no hay pairs, cada jugador es su propio team.
    const { data: dbPairs } = await supabase
      .from("tournament_pairs")
      .select("user_a_id, user_b_id")
      .eq("tournament_id", tournamentId);

    let teams: Team[];

    if (dbPairs && dbPairs.length > 0) {
      // Formato con parejas preestablecidas: cada fila de tournament_pairs = un team
      teams = dbPairs.map((p: { user_a_id: string; user_b_id: string }, i: number) => ({
        userIds: [p.user_a_id, p.user_b_id],
        label: `Pareja ${i + 1}`,
      }));
    } else {
      // Fallback: singles (teamSize=1) o torneo sin pairs definidos → buildTeams legacy
      const teamSize = modality === "singles" ? 1 : 2;
      teams = buildTeams(playerIds, teamSize);
    }

    if (teams.length < 2) return { ok: false, error: "Necesitas al menos 2 equipos" };

    let pairings: { round: number; board: number; teamA: Team; teamB: Team }[] = [];

    if (format === "rotation" || format === "points_league") {
      // No auto pairings for these formats
      return { ok: true };
    } else if (format === "round_robin") {
      pairings = generateRoundRobin(teams, numBoards);
    } else if (format === "swiss") {
      // Swiss generates one round at a time; generate round 1 with random pairing
      pairings = generateSwissRound(teams, [], 1, new Set(), numBoards);
    } else if (format === "single_elim") {
      pairings = generateSingleElimRound1(teams, numBoards);
    } else if (format === "double_elim") {
      pairings = generateSingleElimRound1(teams, numBoards); // winner bracket round 1
    }

    const rows = pairings.map((p) => ({
      tournament_id: tournamentId,
      round: p.round,
      board: p.board,
      team_a_user_ids: p.teamA.userIds,
      team_b_user_ids: p.teamB.userIds,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("tournament_pairings").insert(rows);
      if (error) return { ok: false, error: error.message };
    }

    // Update current_round to 1
    await supabase.from("tournaments").update({ current_round: 1 }).eq("id", tournamentId);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function generateNextRound(
  tournamentId: string
): Promise<{ ok: true; done: boolean; nextRound?: number } | { ok: false; error: string }> {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    const { data: t } = await supabase
      .from("tournaments")
      .select("*, tournament_players(user_id)")
      .eq("id", tournamentId)
      .eq("created_by", user.id)
      .single();
    if (!t) return { ok: false, error: "Torneo no encontrado" };

    const format: TournamentFormat = t.format ?? "rotation";
    if (format !== "swiss" && format !== "round_robin") {
      return { ok: false, error: "Solo aplicable a formatos suizo y round_robin" };
    }

    const playerIds: string[] = (t.tournament_players ?? []).map((p: any) => p.user_id);
    const numBoards: number = (t as Record<string, unknown>).num_boards as number ?? 1;

    // Respetar tournament_pairs si existen (igual que generateInitialPairings)
    const { data: dbPairs } = await supabase
      .from("tournament_pairs")
      .select("user_a_id, user_b_id")
      .eq("tournament_id", tournamentId);

    let teams: Team[];
    if (dbPairs && dbPairs.length > 0) {
      teams = dbPairs.map((p: { user_a_id: string; user_b_id: string }, i: number) => ({
        userIds: [p.user_a_id, p.user_b_id],
        label: `Pareja ${i + 1}`,
      }));
    } else {
      teams = buildTeams(playerIds, 2);
    }

    const currentRound: number = t.current_round ?? 1;

    // Get completed pairings and their results
    const { data: existingPairings } = await supabase
      .from("tournament_pairings")
      .select("*, matches(match_players(team, rank, score))")
      .eq("tournament_id", tournamentId)
      .lte("round", currentRound);

    const standings = computeStandingsFromPairings(teams, existingPairings ?? []);
    const played = buildPlayedSet(existingPairings ?? []);

    let maxRounds: number;
    if (format === "round_robin") {
      // Round robin: n equipos pares → n-1 rondas; n impar → n rondas (con bye)
      maxRounds = teams.length % 2 === 0 ? teams.length - 1 : teams.length;
    } else {
      // Swiss: ceil(log2(n)) + 2 para buena cobertura
      maxRounds = Math.ceil(Math.log2(teams.length)) + 2;
    }

    if (currentRound >= maxRounds) {
      await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
      return { ok: true, done: true };
    }

    const nextRound = currentRound + 1;
    let pairings: { round: number; board: number; teamA: Team; teamB: Team }[];

    if (format === "round_robin") {
      // Para round_robin ya se generaron TODOS los pairings en generateInitialPairings.
      // generateNextRound solo necesita avanzar current_round.
      // No hay nuevos pairings que insertar.
      pairings = [];
    } else {
      // Swiss: generar la siguiente ronda
      pairings = generateSwissRound(teams, standings, nextRound, played, numBoards);
    }

    const rows = pairings.map((p) => ({
      tournament_id: tournamentId,
      round: p.round,
      board: p.board,
      team_a_user_ids: p.teamA.userIds,
      team_b_user_ids: p.teamB.userIds,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("tournament_pairings").insert(rows);
      if (error) return { ok: false, error: error.message };
    }

    await supabase.from("tournaments").update({ current_round: nextRound }).eq("id", tournamentId);
    return { ok: true, done: false, nextRound };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

// ─── Algorithms ──────────────────────────────────────────────────────────────

function buildTeams(playerIds: string[], teamSize: number): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + teamSize - 1 < playerIds.length; i += teamSize) {
    const ids = playerIds.slice(i, i + teamSize);
    teams.push({ userIds: ids, label: `Equipo ${teams.length + 1}` });
  }
  return teams;
}

/**
 * Asigna número de mesa a partir del índice de la partida dentro de una ronda.
 * Con num_boards mesas: partida 0 → mesa 1, partida 1 → mesa 2, …
 * (round-robin módulo num_boards, nunca 0-based).
 */
function assignBoard(matchIndexInRound: number, numBoards: number): number {
  return (matchIndexInRound % numBoards) + 1;
}

function generateRoundRobin(teams: Team[], numBoards = 1): { round: number; board: number; teamA: Team; teamB: Team }[] {
  const n = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  const rounds = n - 1;
  const rotate = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const result: { round: number; board: number; teamA: Team; teamB: Team }[] = [];

  for (let r = 0; r < rounds; r++) {
    const circle = [0, ...rotate];
    let matchIdx = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a < teams.length && b < teams.length) {
        result.push({ round: r + 1, board: assignBoard(matchIdx, numBoards), teamA: teams[a], teamB: teams[b] });
        matchIdx++;
      }
    }
    rotate.push(rotate.shift()!);
  }

  return result;
}

function generateSwissRound(
  teams: Team[],
  standings: Standing[],
  round: number,
  played: Set<string> = new Set(),
  numBoards = 1,
): { round: number; board: number; teamA: Team; teamB: Team }[] {
  // Sort by score descending
  const sorted = round === 1
    ? [...teams].sort(() => Math.random() - 0.5) // random first round
    : [...teams].sort((a, b) => {
        const sa = standings.find((s) => s.teamUserIds.join(",") === a.userIds.join(","))?.score ?? 0;
        const sb = standings.find((s) => s.teamUserIds.join(",") === b.userIds.join(","))?.score ?? 0;
        return sb - sa;
      });

  const result: { round: number; board: number; teamA: Team; teamB: Team }[] = [];
  const used = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const keyA = sorted[i].userIds.join(",");
    if (used.has(keyA)) continue;

    // Find best available opponent
    let matched = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const keyB = sorted[j].userIds.join(",");
      if (used.has(keyB)) continue;
      const playedKey = [keyA, keyB].sort().join("|");
      if (!played.has(playedKey)) {
        result.push({ round, board: assignBoard(result.length, numBoards), teamA: sorted[i], teamB: sorted[j] });
        used.add(keyA);
        used.add(keyB);
        matched = true;
        break;
      }
    }
    // Bye if no opponent found (odd teams)
    if (!matched) used.add(keyA);
  }

  return result;
}

function generateSingleElimRound1(teams: Team[], numBoards = 1): { round: number; board: number; teamA: Team; teamB: Team }[] {
  // Seed: best vs worst (1 vs N, 2 vs N-1, ...)
  const n = nextPow2(teams.length);
  const seeded = [...teams];
  // Pad with byes (null)
  while (seeded.length < n) seeded.push({ userIds: [], label: "BYE" });

  const result: { round: number; board: number; teamA: Team; teamB: Team }[] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = seeded[i];
    const b = seeded[n - 1 - i];
    // Skip BYE vs BYE
    if (a.userIds.length === 0 && b.userIds.length === 0) continue;
    result.push({ round: 1, board: assignBoard(result.length, numBoards), teamA: a, teamB: b });
  }
  return result;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function buildPlayedSet(pairings: any[]): Set<string> {
  const played = new Set<string>();
  for (const p of pairings) {
    const a = (p.team_a_user_ids ?? []).join(",");
    const b = (p.team_b_user_ids ?? []).join(",");
    played.add([a, b].sort().join("|"));
  }
  return played;
}

function computeStandingsFromPairings(teams: Team[], pairings: any[]): Standing[] {
  const map = new Map<string, Standing>();

  for (const team of teams) {
    const key = team.userIds.join(",");
    map.set(key, {
      teamUserIds: team.userIds,
      label: team.label,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      score: 0,
    });
  }

  for (const p of pairings) {
    const match = p.matches;
    if (!match) continue;
    const players = match.match_players ?? [];
    const teamAScore = players.find((mp: any) => mp.team === 1)?.score ?? 0;
    const teamBScore = players.find((mp: any) => mp.team === 2)?.score ?? 0;
    const teamAWon = (players.find((mp: any) => mp.team === 1)?.rank ?? 2) === 1;

    const keyA = (p.team_a_user_ids ?? []).join(",");
    const keyB = (p.team_b_user_ids ?? []).join(",");

    const sA = map.get(keyA);
    const sB = map.get(keyB);

    if (sA) {
      sA.wins += teamAWon ? 1 : 0;
      sA.losses += teamAWon ? 0 : 1;
      sA.pointsFor += teamAScore;
      sA.pointsAgainst += teamBScore;
    }
    if (sB) {
      sB.wins += teamAWon ? 0 : 1;
      sB.losses += teamAWon ? 1 : 0;
      sB.pointsFor += teamBScore;
      sB.pointsAgainst += teamAScore;
    }
  }

  // Integer ranking: wins * 1e6 + pointsFor. Evita inestabilidad de
  // floating point cuando pointsFor es grande (un torneo largo puede
  // acumular >10000 pts y romper el invariante "1 win > cualquier tiebreak").
  // 1e6 cubre cualquier pointsFor real (64 partidos × 200 pts = 12.8k).
  for (const s of map.values()) {
    s.score = s.wins * 1_000_000 + s.pointsFor;
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}
