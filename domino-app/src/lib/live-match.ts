"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { validateMatchClosure } from "@/lib/match-validation";
import { buildMatchEmailMeta, sendToUserIds } from "@/lib/match-notifications";
import { matchAttestRequestedEmail } from "@/lib/email-templates";

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
  /** Límite de tiempo en minutos (R6). null = sin límite. */
  time_limit_minutes: z.number().int().min(5).max(180).nullable().optional(),
  /** Si la partida afecta al Elo global. Si tournament_id está y rated no se
   *  pasa, se hereda de tournaments.rated. Default para quick match: true. */
  rated: z.boolean().optional(),
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

  // Si la partida tiene límite de tiempo, el timer arranca inmediatamente
  // al crearla (ya está "in_progress" desde el momento de creación).
  const now = new Date().toISOString();
  const timeLimitMinutes = i.time_limit_minutes ?? null;

  // Resolución de `rated`:
  //   1. Si el caller lo pasa explícito, ese gana (UI quick match toggle).
  //   2. Si la partida pertenece a un torneo, hereda tournaments.rated.
  //   3. Default true (quick match estándar, afecta el Elo).
  let rated = i.rated ?? true;
  if (i.rated === undefined && i.tournament_id) {
    const { data: t } = await supabase
      .from("tournaments")
      .select("rated")
      .eq("id", i.tournament_id)
      .single();
    if (t && typeof t.rated === "boolean") rated = t.rated;
  }

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      format: i.format,
      set_size: i.set_size,
      modality: i.modality,
      target_points: i.target_points,
      capicua_bonus: i.capicua_bonus,
      status: "in_progress",
      rated,
      created_by: user.id,
      tournament_id: i.tournament_id ?? null,
      // R6: timer. Si hay time_limit_minutes, timer arranca ya.
      time_limit_minutes: timeLimitMinutes,
      timer_started_at: timeLimitMinutes ? now : null,
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
   START TIMER — arranca el cronómetro de la partida (idempotente)
   ============================================================ */

/**
 * Setea timer_started_at en el match si aún no está seteado.
 * Idempotente: la query incluye `.is("timer_started_at", null)` por lo que
 * si el timer ya arrancó no se sobreescribe.
 *
 * Solo aplica si el match tiene time_limit_minutes configurado.
 */
export async function startTimer(match_id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: match } = await supabase
    .from("matches")
    .select("created_by, time_limit_minutes, timer_started_at, status")
    .eq("id", match_id)
    .single();

  if (!match) return { ok: false, error: "Partida no encontrada." };
  if (match.created_by !== user.id) return { ok: false, error: "Solo el creador puede iniciar el timer." };
  if (match.status !== "in_progress") return { ok: false, error: "La partida no está en curso." };

  // Sin time_limit_minutes no hay timer que iniciar
  if (!(match as Record<string, unknown>).time_limit_minutes) {
    return { ok: false, error: "Esta partida no tiene límite de tiempo." };
  }

  // Idempotente: solo actualiza si timer_started_at es null
  const { error } = await supabase
    .from("matches")
    .update({ timer_started_at: new Date().toISOString() })
    .eq("id", match_id)
    .is("timer_started_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/matches/${match_id}/live`);
  return { ok: true };
}

/* ============================================================
   ADD ROUND (sumar puntos a un equipo)
   ============================================================ */

const AddRoundSchema = z.object({
  match_id: z.string().uuid(),
  team: z.number().int().min(1).max(2),
  points: z.number().int().min(0).max(999),
  kind: z.enum(["points","capicua","tranque"]).default("points"),
}).refine(
  // Tranque puede ser 0 puntos (solo marca la mano sin sumar). points >= 1
  // requerido para points/capicua.
  (v) => v.kind === "tranque" || v.points >= 1,
  { message: "points debe ser >= 1 (excepto tranque)" }
);

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

export async function cancelLiveMatch(match_id: string, redirect_to: string = "/dashboard") {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", match_id);
  if (error) return { ok: false as const, error: error.message };
  redirect(redirect_to);
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

  // Sincronizar scores acumulados desde los rounds antes de finalizar.
  // Si syncMatchScores falla (e.g., RLS), no es bloqueante — abajo computamos
  // directamente desde match_rounds que es la source of truth.
  await syncMatchScores(match_id);

  // Computar team scores DIRECTAMENTE desde match_rounds (source of truth),
  // no desde match_players.score (denormalizado, puede estar stale si RLS
  // bloqueó el sync).
  const { data: rounds, error: rndErr } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", match_id);
  if (rndErr) {
    console.error("[finalizeMatch] match_rounds query failed:", rndErr);
    return { ok: false, error: "No se pudieron leer los puntos de la partida." };
  }
  const teamScores: Record<number, number> = { 1: 0, 2: 0 };
  for (const r of rounds ?? []) {
    teamScores[r.team] = (teamScores[r.team] ?? 0) + r.points;
  }

  const { data: matchRow } = await supabase
    .from("matches")
    .select("target_points, time_limit_minutes, timer_started_at, tournament_id, rated, created_by")
    .eq("id", match_id)
    .single();
  if (!matchRow) return { ok: false, error: "Partida no encontrada." };
  // Casts defensivos — la generación de tipos de Supabase puede no incluir
  // todavía requires_attestation (mig 0049). Pedimos los campos necesarios
  // para decidir bypass.
  const matchRowExt = matchRow as Record<string, unknown>;

  // `time_expired` no es una columna en DB (Postgres no permite now() en
  // GENERATED ALWAYS AS STORED). Se calcula acá desde timer_started_at +
  // time_limit_minutes. Es la única fuente de verdad server-side.
  const timerStartedAt = (matchRow as Record<string, unknown>).timer_started_at as string | null;
  const timeLimitMinutes = (matchRow as Record<string, unknown>).time_limit_minutes as number | null;

  let timeExpired = false;
  if (timerStartedAt && timeLimitMinutes) {
    const endMs = new Date(timerStartedAt).getTime() + timeLimitMinutes * 60 * 1000;
    timeExpired = Date.now() > endMs;
  }
  const validation = validateMatchClosure(
    teamScores[1],
    teamScores[2],
    matchRow.target_points,
    timeExpired,
  );
  if (validation.status === 'in_progress') {
    return { ok: false, error: "Ningún equipo ha llegado a la meta aún." };
  }
  if (validation.status === 'tied_at_goal') {
    return { ok: false, error: "Empate — deben jugar una mano adicional para desempatar." };
  }
  if (validation.status === 'time_expired_finishable' && validation.winnerTeam === null) {
    return { ok: false, error: "Tiempo agotado con empate — deben jugar una mano adicional para desempatar." };
  }

  // ============================================================
  // ATTESTATION BYPASS — saltea consenso 3-of-4
  // ============================================================
  // Si el torneo tiene requires_attestation=false, la partida finaliza
  // directo a 'confirmed' sin pasar por pending_attestation. F1.7
  // generaliza el viejo "polla bypass" a un flag a nivel torneo —
  // continuous_league heredó requires_attestation=false vía backfill
  // (mig 0050), y el wizard de F1.4 expone el toggle para que cualquier
  // formato pueda saltearse el consenso (decisión del organizer).
  //
  // Cuando requires_attestation=true → flow normal (3-of-4 via RPC
  // finalize_match + email dispatch a los otros 3 jugadores).
  const tournamentId = matchRowExt.tournament_id as string | null ?? null;
  let requiresAttestation = true; // default seguro: si no hay tournament, attest
  if (tournamentId) {
    const { data: t } = await supabase
      .from("tournaments")
      .select("requires_attestation")
      .eq("id", tournamentId)
      .single();
    const tExt = t as Record<string, unknown> | null;
    // Si la columna requires_attestation no existe todavía (migración no
    // aplicada en algún env), tratamos como true (flow normal). Solo
    // hacemos bypass cuando el flag explícitamente es false.
    requiresAttestation = tExt?.requires_attestation !== false;
  }

  if (!requiresAttestation) {
    // Solo el scorekeeper (creator) puede finalizar bypassing
    const createdBy = matchRowExt.created_by as string | undefined;
    if (createdBy !== user.id) {
      return { ok: false, error: "Solo el creador puede finalizar la partida." };
    }
    const { error: updErr } = await supabase
      .from("matches")
      .update({ status: "confirmed", finished_at: new Date().toISOString(), scorekeeper_id: user.id })
      .eq("id", match_id);
    if (updErr) {
      console.error("[finalizeMatch attestation bypass] update failed:", updErr);
      return { ok: false, error: "No se pudo finalizar la partida." };
    }

    // Aplicar rating si el match está rateado. Best-effort: si falla logueamos
    // pero NO bloqueamos — el match queda confirmed igualmente.
    const rated = matchRowExt.rated as boolean | undefined ?? true;
    if (rated) {
      try {
        const { applyMatchRating } = await import("@/lib/match-attest-actions");
        const ratingResult = await applyMatchRating(match_id);
        if (!ratingResult.ok) {
          console.error("[finalizeMatch attestation bypass] applyMatchRating failed:", ratingResult.error);
        }
      } catch (e) {
        console.error("[finalizeMatch attestation bypass] rating import/apply error:", e);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath(`/matches/${match_id}`);
    if (tournamentId) revalidatePath(`/tournaments/${tournamentId}`);
    return { ok: true };
  }

  // ============================================================
  // FLOW NORMAL (no-polla) — pending_attestation + email dispatch
  // ============================================================
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

  // Notificar por email a los 3 jugadores no-scorekeeper que deben firmar.
  // Fire-and-forget — no bloquea el response al scorekeeper.
  void (async () => {
    try {
      const { data: mps } = await supabase
        .from("match_players")
        .select("user_id")
        .eq("match_id", match_id);
      const recipients = (mps ?? [])
        .map((mp: any) => mp.user_id as string)
        .filter((uid) => uid !== user.id);
      if (recipients.length === 0) return;

      const meta = await buildMatchEmailMeta(supabase, match_id);
      if (!meta) return;

      await sendToUserIds(supabase, recipients, () =>
        matchAttestRequestedEmail(meta)
      );
    } catch (e) {
      console.error("[finalizeMatch] attest email dispatch failed:", e);
    }
  })();

  return { ok: true };
}

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Denormaliza match_rounds → match_players.score por equipo. Best-effort:
 * si RLS u otro error bloquea el update, lo logueamos pero NO rompemos el
 * flujo. finalizeMatch/applyMatchRating computan independientemente desde
 * match_rounds para no depender de esta denormalización.
 */
async function syncMatchScores(match_id: string) {
  const supabase = await supabaseServer();
  const { data: rounds, error: rndErr } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", match_id);
  if (rndErr) {
    console.error("[syncMatchScores] rounds fetch failed:", rndErr);
    return;
  }
  const scores: Record<number, number> = { 1: 0, 2: 0 };
  for (const r of rounds ?? []) scores[r.team] = (scores[r.team] ?? 0) + r.points;
  for (const [team, score] of Object.entries(scores)) {
    const { error: upErr } = await supabase
      .from("match_players")
      .update({ score })
      .eq("match_id", match_id)
      .eq("team", Number(team));
    if (upErr) console.error(`[syncMatchScores] update team ${team} failed:`, upErr);
  }
}
