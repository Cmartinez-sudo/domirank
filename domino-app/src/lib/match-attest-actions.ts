"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { computeRatingPayload } from "@/lib/match-rating-compute";
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
 * Calcula el Elo y aplica el rating atómicamente vía SQL apply_match_rating.
 * Idempotente — si la partida ya tiene rated_at, no hace nada.
 * Internal: típicamente lo llama attestMatch cuando se alcanza quórum.
 * También puede llamarse desde un job que detecta matches confirmed sin ratear.
 */
export async function applyMatchRating(matchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, format, set_size, rated_at, rated")
    .eq("id", matchId)
    .single();
  if (!match) return { ok: false, error: "match_not_found" };
  if (match.status !== "confirmed") return { ok: false, error: "not_confirmed" };
  if (match.rated_at) return { ok: true }; // ya aplicado
  // Toggle "amistosa": si la partida se creó con rated=false (quick match
  // amistoso o torneo con rated=false), no afecta el Elo. Marca rated_at
  // para que el flow de attestation no quede pendiente, pero sin ejecutar
  // la lógica de rating.
  if (match.rated === false) {
    await supabase
      .from("matches")
      .update({ rated_at: new Date().toISOString() })
      .eq("id", matchId);
    return { ok: true };
  }

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team")
    .eq("match_id", matchId);
  if (!mps || mps.length === 0) return { ok: false, error: "no_players" };

  // Source of truth for scores: match_rounds. match_players.score may be
  // stale if RLS blocked syncMatchScores (see migration 0021).
  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", matchId);

  const eloCol   = ratingCol(match.set_size as SetCode, match.format as FormatCode, "elo");
  const gamesCol = ratingCol(match.set_size as SetCode, match.format as FormatCode, "games");
  const userIds  = mps.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(`id, ${eloCol}, ${gamesCol}`)
    .in("id", userIds);
  if (pErr || !profiles) return { ok: false, error: pErr?.message ?? "profiles_load_failed" };

  const computed = computeRatingPayload({
    format:        match.format as FormatCode,
    setSize:       match.set_size as SetCode,
    matchPlayers:  mps,
    matchRounds:   rounds ?? [],
    profiles:      profiles as unknown as Array<{ id: string; [k: string]: string | number }>,
  });
  if (!computed.ok) return { ok: false, error: computed.error };

  const { error: rpcErr } = await supabase.rpc("apply_match_rating", {
    p_match_id: matchId,
    p_updates:  computed.payload,
  });

  if (rpcErr) {
    console.error("apply_match_rating RPC failed:", rpcErr);
    return { ok: false, error: rpcErr.message };
  }

  return { ok: true };
}
