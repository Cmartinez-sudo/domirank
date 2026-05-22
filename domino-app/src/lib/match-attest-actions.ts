"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { updateRatings, type TeamInput } from "@/lib/rating";
import { ratingCol } from "@/lib/rating-buckets";
import type { SetCode, FormatCode } from "@/lib/modalidades";
import { buildMatchEmailMeta, sendToUserIds } from "@/lib/match-notifications";
import { matchConfirmedEmail, matchDisputedEmail } from "@/lib/email-templates";

export type AttestResult =
  | { ok: true; newStatus: "pending_attestation" | "confirmed" | "disputed" }
  | { ok: false; error: string };

/**
 * Firma o disputa una partida.
 *
 * Flow:
 *   1. SQL RPC `attest_match` inserta/actualiza la attestation y evalúa el quórum.
 *   2. Si la partida pasa a 'confirmed' como resultado, este TS aplica el rating
 *      OpenSkill inmediatamente (en el mismo request) llamando applyMatchRating.
 *   3. Si pasa a 'disputed' o sigue pending, no aplica rating todavía.
 *
 * Idempotencia: aplicar rating se gatea por matches.rated_at IS NULL en SQL.
 */
export async function attestMatch(
  matchId: string,
  action: "confirm" | "dispute",
  comment?: string
): Promise<AttestResult> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Capturar status previo para detectar transición (y evitar reenviar
  // emails si alguien firma cuando el match ya está confirmed/disputed).
  const { data: priorMatch } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .maybeSingle();
  const priorStatus = priorMatch?.status as
    | "pending_attestation" | "confirmed" | "disputed" | "in_progress" | "cancelled"
    | null
    | undefined;

  const { data: newStatus, error } = await supabase.rpc("attest_match", {
    p_match_id: matchId,
    p_action: action,
    p_comment: comment ?? null,
  });

  if (error) {
    const m = error.message ?? "";
    const friendly =
      m.includes("not_a_participant") ? "No eres jugador de esta partida" :
      m.includes("invalid_action")    ? "Acción inválida" :
      m.includes("match_not_found")   ? "Partida no encontrada" :
      "No se pudo registrar la firma";
    console.error("attest_match RPC failed:", error);
    return { ok: false, error: friendly };
  }

  const status = newStatus as "pending_attestation" | "confirmed" | "disputed";

  // Si la attestation acabó de confirmar el match, aplica el rating ahora
  if (status === "confirmed") {
    const ratingResult = await applyMatchRating(matchId);
    if (!ratingResult.ok) {
      console.error("applyMatchRating failed after confirm:", ratingResult.error);
      // El match sigue confirmed pero sin rating aplicado. Otro request
      // o el cron lo pueden retomar (rated_at IS NULL).
    }
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/dashboard");
  if (status === "confirmed") {
    revalidatePath("/leaderboard");
  }

  // Notificar por email a los 4 jugadores SOLO si el estado transitó.
  // Si el match ya estaba confirmed/disputed antes, no reenviamos.
  const transitioned =
    (status === "confirmed" || status === "disputed") &&
    priorStatus !== status;
  if (transitioned) {
    void (async () => {
      try {
        const { data: mps } = await supabase
          .from("match_players")
          .select("user_id")
          .eq("match_id", matchId);
        const recipients = (mps ?? []).map((mp: any) => mp.user_id as string);
        if (recipients.length === 0) return;

        const meta = await buildMatchEmailMeta(supabase, matchId);
        if (!meta) return;

        const builder = status === "confirmed"
          ? () => matchConfirmedEmail(meta)
          : () => matchDisputedEmail(meta);

        await sendToUserIds(supabase, recipients, builder);
      } catch (e) {
        console.error(`[attestMatch] ${status} email dispatch failed:`, e);
      }
    })();
  }

  return { ok: true, newStatus: status };
}

/**
 * Calcula OpenSkill y aplica el rating atómicamente vía SQL apply_match_rating.
 * Idempotente — si la partida ya tiene rated_at, no hace nada.
 * Internal: típicamente lo llama attestMatch cuando se alcanza quórum.
 * También puede llamarse desde un job que detecta matches confirmed sin ratear.
 */
export async function applyMatchRating(matchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, format, set_size, rated_at")
    .eq("id", matchId)
    .single();
  if (!match) return { ok: false, error: "match_not_found" };
  if (match.status !== "confirmed") return { ok: false, error: "not_confirmed" };
  if (match.rated_at) return { ok: true }; // ya aplicado

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team")
    .eq("match_id", matchId);
  if (!mps || mps.length === 0) return { ok: false, error: "no_players" };

  // Compute team scores DIRECTAMENTE desde match_rounds (source of truth).
  // match_players.score puede estar stale si RLS bloqueó syncMatchScores
  // (ver migración 0021). Esto blinda el ranking contra esa inconsistencia.
  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", matchId);
  const teamScores: Record<number, number> = {};
  for (const r of rounds ?? []) {
    teamScores[r.team] = (teamScores[r.team] ?? 0) + r.points;
  }
  // Asegurar que todos los teams de match_players tengan entry (aunque sea 0)
  for (const mp of mps) {
    if (teamScores[mp.team] === undefined) teamScores[mp.team] = 0;
  }

  // Cargar ratings actuales por bucket
  const muCol    = ratingCol(match.set_size as SetCode, match.format as FormatCode, "mu");
  const sigmaCol = ratingCol(match.set_size as SetCode, match.format as FormatCode, "sigma");
  const userIds  = mps.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(`id, ${muCol}, ${sigmaCol}`)
    .in("id", userIds);
  if (pErr || !profiles) return { ok: false, error: pErr?.message ?? "profiles_load_failed" };
  const byId = new Map(profiles.map((p: any) => [p.id, p]));

  // Armar teamInputs
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
      return { user_id: r.user_id, mu: Number(p[muCol]), sigma: Number(p[sigmaCol]) };
    }),
  }));

  const updates = updateRatings(teamInputs);

  const { error: rpcErr } = await supabase.rpc("apply_match_rating", {
    p_match_id: matchId,
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
    console.error("apply_match_rating RPC failed:", rpcErr);
    return { ok: false, error: rpcErr.message };
  }

  return { ok: true };
}
