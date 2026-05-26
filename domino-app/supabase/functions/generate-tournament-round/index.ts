// supabase/functions/generate-tournament-round/index.ts
// Deployed as a Supabase Edge Function (Deno runtime).
//
// Required env vars (auto-provided by Supabase runtime):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Security: validates Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Llamado por el trigger notify_round_complete() vía pg_net cuando todas
// las partidas de una ronda pasan a 'confirmed'.
//
// Inputs (JSON body):
//   tournament_id   uuid
//   completed_round number  (la ronda que acaba de completarse)
//
// Outputs (JSON):
//   { ok: true, next_round: number, inserted: number }
//   { ok: false, error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Auth validation ──────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expectedKey) return false;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return token === expectedKey;
}

// ── Input validation ─────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// ── In-memory rate limit ─────────────────────────────────────────────────────
// Per-tournament bucket: max 5 calls / 60s. Generating the same round more
// than 5 times per minute is always a bug or abuse — the trigger only fires
// once per round transition normally. Per-instance only.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 5;
const callCount = new Map<string, { count: number; resetAt: number }>();

function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const entry = callCount.get(key);
  if (!entry || entry.resetAt < now) {
    callCount.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

// ── Berger schedule (circle method) — portado de tournament-formats-engine.ts ─
//
// Mantiene sincronía conceptual con el TS del frontend. Si el algoritmo
// cambia en tournament-formats-engine.ts, actualizar aquí también.

type BergerMatchup = {
  round: number;
  board: number;
  teamAIndex: number;
  teamBIndex: number;
  isBye: boolean;
};

function bergerSchedule(teamCount: number): BergerMatchup[] {
  if (teamCount < 2) return [];
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const totalRounds = n - 1;
  const rotating: number[] = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const result: BergerMatchup[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const circle = [0, ...rotating];
    let board = 1;
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      result.push({
        round: r + 1,
        board,
        teamAIndex: a,
        teamBIndex: b,
        isBye: a >= teamCount || b >= teamCount,
      });
      board++;
    }
    rotating.unshift(rotating.pop()!);
  }
  return result;
}

// ── Swiss pairing (greedy by standings) ──────────────────────────────────────

type Pairing = {
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  board: number;
};

function buildSwissPairings(
  teams: { userIds: string[] }[],
  standings: { teamUserIds: string[]; score: number }[],
  round: number,
  played: Set<string>,
): Pairing[] {
  const sorted =
    round === 1
      ? [...teams].sort(() => Math.random() - 0.5)
      : [...teams].sort((a, b) => {
          const sa =
            standings.find(
              (s) => s.teamUserIds.join(",") === a.userIds.join(","),
            )?.score ?? 0;
          const sb =
            standings.find(
              (s) => s.teamUserIds.join(",") === b.userIds.join(","),
            )?.score ?? 0;
          return sb - sa;
        });

  const result: Pairing[] = [];
  const used = new Set<string>();
  const byeTeams: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const keyA = sorted[i].userIds.join(",");
    if (used.has(keyA)) continue;
    let matched = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const keyB = sorted[j].userIds.join(",");
      if (used.has(keyB)) continue;
      const playedKey = [keyA, keyB].sort().join("|");
      if (!played.has(playedKey)) {
        result.push({
          team_a_user_ids: sorted[i].userIds,
          team_b_user_ids: sorted[j].userIds,
          board: result.length + 1,
        });
        used.add(keyA);
        used.add(keyB);
        matched = true;
        break;
      }
    }
    // BYE implícito: si no encontramos rival, el equipo se queda sin match.
    // Documentado en SECURITY_AUDIT.md L2.
    if (!matched) {
      used.add(keyA);
      byeTeams.push(keyA);
    }
  }

  if (byeTeams.length > 0) {
    console.warn(
      `[swiss-edge] round ${round}: ${byeTeams.length} team(s) without pairing (implicit BYE):`,
      byeTeams,
    );
  }

  return result;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let tournament_id: string;
  let completed_round: number;

  try {
    const body = await req.json();
    if (!isUuid(body?.tournament_id)) {
      throw new Error("invalid tournament_id");
    }
    completed_round = Number(body?.completed_round ?? 1);
    // Cap defensivo: rondas razonables. 100 cubre cualquier formato real.
    if (
      !Number.isInteger(completed_round) ||
      completed_round < 1 ||
      completed_round > 100
    ) {
      throw new Error("invalid completed_round");
    }
    tournament_id = body.tournament_id;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!rateLimitOk(`round:${tournament_id}`)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // ── 1. Cargar torneo ───────────────────────────────────────────────────────
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, format, current_round, total_rounds, status")
    .eq("id", tournament_id)
    .single();

  if (tErr || !tournament) {
    return new Response(
      JSON.stringify({ ok: false, error: "tournament_not_found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (tournament.status !== "in_progress") {
    return new Response(
      JSON.stringify({ ok: false, error: "tournament_not_in_progress" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const nextRound = completed_round + 1;

  // ── 2. Cargar jugadores y pairings anteriores ──────────────────────────────
  const { data: pairs } = await supabase
    .from("tournament_pairs")
    .select("user_a_id, user_b_id")
    .eq("tournament_id", tournament_id);

  // Construir equipos desde tournament_pairs
  const teams: { userIds: string[] }[] = (pairs ?? []).map((p) => ({
    userIds: [p.user_a_id, p.user_b_id],
  }));

  if (teams.length < 2) {
    return new Response(
      JSON.stringify({ ok: false, error: "not_enough_teams" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── 3. Calcular pairings para la siguiente ronda ───────────────────────────
  let newPairings: Pairing[];

  if (tournament.format === "round_robin") {
    // Para round_robin, todos los pairings ya se insertaron en generateInitialPairings.
    // Solo actualizamos current_round en el RPC.
    newPairings = [];
  } else if (tournament.format === "swiss") {
    // Cargar pairings pasados para calcular standings y played set
    const { data: existingPairings } = await supabase
      .from("tournament_pairings")
      .select(
        "round, team_a_user_ids, team_b_user_ids, match_id, matches(match_players(team, score))",
      )
      .eq("tournament_id", tournament_id)
      .lte("round", completed_round);

    // Standings: wins * 3 + pointsFor tiebreak
    const standingsMap = new Map<string, { teamUserIds: string[]; score: number }>();
    for (const t of teams) {
      standingsMap.set(t.userIds.join(","), { teamUserIds: t.userIds, score: 0 });
    }
    const playedSet = new Set<string>();

    for (const p of existingPairings ?? []) {
      const keyA = (p.team_a_user_ids ?? []).join(",");
      const keyB = (p.team_b_user_ids ?? []).join(",");
      playedSet.add([keyA, keyB].sort().join("|"));

      const matchData = p.matches as
        | { match_players: { team: number; score: number }[] }
        | null;
      if (!matchData) continue;
      const players = matchData.match_players ?? [];
      const teamAScore = players.filter((mp) => mp.team === 1).reduce((s, mp) => s + mp.score, 0);
      const teamBScore = players.filter((mp) => mp.team === 2).reduce((s, mp) => s + mp.score, 0);
      const teamAWon = teamAScore > teamBScore;

      // Integer scoring: 1 win = 3_000_000, +pointsFor como tiebreak.
      // Mismo invariante que tournament-formats-engine.computeStandings:
      // 1 win siempre > cualquier acumulado de pointsFor (max ~13k).
      const sA = standingsMap.get(keyA);
      const sB = standingsMap.get(keyB);
      if (sA) sA.score += (teamAWon ? 3_000_000 : 0) + teamAScore;
      if (sB) sB.score += (teamAWon ? 0 : 3_000_000) + teamBScore;
    }

    const standings = Array.from(standingsMap.values()).sort((a, b) => b.score - a.score);
    newPairings = buildSwissPairings(teams, standings, nextRound, playedSet);
  } else {
    // single_elim, double_elim: bracket advancement no está implementado aquí.
    // El organizador avanza el bracket manualmente.
    return new Response(
      JSON.stringify({ ok: false, error: "format_not_supported_for_auto_advance" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── 4. Commit de pairings vía RPC ──────────────────────────────────────────
  const pairingsPayload = newPairings.map((p) => ({
    team_a_user_ids: p.team_a_user_ids,
    team_b_user_ids: p.team_b_user_ids,
    board: p.board,
  }));

  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    "generate_next_round_rpc",
    {
      p_tournament_id: tournament_id,
      p_next_round: nextRound,
      p_pairings: JSON.stringify(pairingsPayload),
    },
  );

  if (rpcErr) {
    console.error("[generate-round] RPC error:", rpcErr);
    return new Response(
      JSON.stringify({ ok: false, error: rpcErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const rpcData = rpcResult as Record<string, unknown>;
  if (!rpcData.ok) {
    return new Response(JSON.stringify(rpcData), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guard: si la ronda ya existía (double-fire del trigger), no enviar notificaciones.
  // El RPC devuelve inserted=0 y note='round_already_exists' en ese caso.
  if (rpcData.note === "round_already_exists" || rpcData.inserted === 0) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "round_already_exists" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── 5. Notificar a los participantes ──────────────────────────────────────
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournament_id);

  if (players && players.length > 0) {
    const notifications = players.map((p: { user_id: string }) => ({
      user_id: p.user_id,
      type: "tournament_round_ready",
      ref_tournament_id: tournament_id,
      payload: { round: nextRound },
    }));

    const { error: notifErr } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notifErr) {
      // No es un error fatal — los pairings ya se insertaron. Solo loguear.
      console.error("[generate-round] notification insert failed:", notifErr);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      next_round: nextRound,
      inserted: rpcData.inserted ?? 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
