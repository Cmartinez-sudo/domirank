import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { computeRatingPayload } from "@/lib/match-rating-compute";
import { bucketColumn, bucketForMatch } from "@/lib/rating-buckets";
import type { SetCode, FormatCode } from "@/lib/modalidades";
import { buildMatchEmailMeta, sendToMatchPlayers } from "@/lib/match-notifications";
import { matchConfirmedEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron — corre diariamente para auto-confirmar partidas que pasaron
 * 7 días sin alcanzar quórum, y luego aplicar el rating Elo a:
 *   1. Las recién auto-confirmadas
 *   2. Cualquier match `confirmed` que quedó con rated_at NULL por una falla
 *      previa (orphan recovery)
 *
 * Protegida con CRON_SECRET en el header Authorization.
 * Para activar el cron, ver vercel.json (schedule diario 03:00 UTC).
 */
export async function GET(request: Request) {
  // Auth: Vercel Cron envía Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("authorization");
  if (!expected) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase;
  try { supabase = supabaseService(); }
  catch (e) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  let autoConfirmed = 0;
  let autoConfirmedIds: string[] = [];
  try {
    const { data, error } = await supabase.rpc("auto_confirm_stale_matches");
    if (error) {
      console.error("[cron] auto_confirm_stale_matches failed:", error);
    } else {
      // El RPC ahora devuelve SETOF uuid; en supabase-js viene como
      // array de objetos { auto_confirm_stale_matches: uuid } o como
      // array de strings dependiendo del cliente. Normalizamos.
      const rows = Array.isArray(data) ? data : [];
      autoConfirmedIds = rows
        .map((r: any) => typeof r === "string" ? r : r?.auto_confirm_stale_matches ?? r?.id ?? null)
        .filter((id): id is string => typeof id === "string");
      autoConfirmed = autoConfirmedIds.length;
    }
  } catch (e) {
    console.error("[cron] auto_confirm exception:", e);
  }

  // Email "tu partida fue confirmada (auto)" SOLO a los recién auto-confirmados.
  // Los orphans (matches confirmed con rated_at NULL) ya fueron notificados
  // por attestMatch cuando alcanzaron quórum — no reenviamos.
  await Promise.all(
    autoConfirmedIds.map(async (matchId) => {
      try {
        const meta = await buildMatchEmailMeta(supabase, matchId);
        if (!meta) return;
        await sendToMatchPlayers(supabase, matchId, () =>
          matchConfirmedEmail({ ...meta, auto: true })
        );
      } catch (e) {
        console.error(`[cron] auto-confirm email failed for ${matchId}:`, e);
      }
    })
  );

  // Aplica rating a TODOS los matches confirmed sin rated_at
  // (los recién auto-confirmados + cualquier orphan previo).
  // Filtramos rated=true: las "amistosas" no se ratean, y dejarlas en
  // este query las haría aparecer eternamente como pendientes.
  const { data: pending, error: pendingErr } = await supabase
    .from("matches")
    .select("id, format, set_size, count_rule, modality, rated")
    .eq("status", "confirmed")
    .eq("rated", true)
    .is("rated_at", null)
    .order("confirmed_at", { ascending: true })
    .limit(100);

  if (pendingErr) {
    console.error("[cron] fetching unrated matches failed:", pendingErr);
    return NextResponse.json({
      autoConfirmed,
      ratingsApplied: 0,
      error: pendingErr.message,
    });
  }

  let ratingsApplied = 0;
  let ratingsFailed  = 0;

  for (const m of pending ?? []) {
    try {
      const ok = await applyRatingForMatch(
        supabase,
        m.id,
        m.format as FormatCode,
        (m.set_size ?? "d6") as SetCode,
        ((m as { count_rule?: string | null }).count_rule ?? null) as
          | "rival" | "mesa" | null,
        (m as { modality?: string | null }).modality ?? null,
      );
      if (ok) ratingsApplied++; else ratingsFailed++;
    } catch (e) {
      console.error(`[cron] applyRating failed for ${m.id}:`, e);
      ratingsFailed++;
    }
  }

  return NextResponse.json({
    autoConfirmed,
    ratingsApplied,
    ratingsFailed,
    ts: new Date().toISOString(),
  });
}

/**
 * Helper que replica applyMatchRating pero usando service role en lugar del
 * cliente authenticated. El motor Elo es el mismo; solo cambia el client.
 */
async function applyRatingForMatch(
  supabase: ReturnType<typeof supabaseService>,
  matchId: string,
  format: FormatCode,
  setSize: SetCode,
  countRule: "rival" | "mesa" | null,
  modality: string | null,
): Promise<boolean> {
  const bucket = bucketForMatch({ set_size: setSize, count_rule: countRule, modality });
  const eloCol   = bucketColumn(bucket, "elo");
  const gamesCol = bucketColumn(bucket, "games");

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team")
    .eq("match_id", matchId);
  if (!mps || mps.length === 0) return false;

  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", matchId);

  const userIds = mps.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(`id, ${eloCol}, ${gamesCol}`)
    .in("id", userIds);
  if (!profiles) return false;

  const computed = computeRatingPayload({
    format,
    setSize,
    countRule,
    modality,
    matchPlayers: mps,
    matchRounds:  rounds ?? [],
    profiles:     profiles as unknown as Array<{ id: string; [k: string]: string | number }>,
  });
  if (!computed.ok) {
    console.error(`[cron] computeRatingPayload failed for ${matchId}:`, computed.error);
    return false;
  }

  const { error } = await supabase.rpc("apply_match_rating", {
    p_match_id: matchId,
    p_updates:  computed.payload,
  });

  if (error) {
    console.error("[cron] apply_match_rating RPC failed:", error);
    return false;
  }
  return true;
}
