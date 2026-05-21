import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";
import { updateRatings, type TeamInput } from "@/lib/rating";
import { ratingCol } from "@/lib/rating-buckets";
import type { SetCode, FormatCode } from "@/lib/modalidades";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron — corre diariamente para auto-confirmar partidas que pasaron
 * 7 días sin alcanzar quórum, y luego aplicar el rating OpenSkill a:
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
  try {
    const { data, error } = await supabase.rpc("auto_confirm_stale_matches");
    if (error) {
      console.error("[cron] auto_confirm_stale_matches failed:", error);
    } else {
      autoConfirmed = data ?? 0;
    }
  } catch (e) {
    console.error("[cron] auto_confirm exception:", e);
  }

  // Aplica rating a TODOS los matches confirmed sin rated_at
  // (los recién auto-confirmados + cualquier orphan previo)
  const { data: pending, error: pendingErr } = await supabase
    .from("matches")
    .select("id, format, set_size")
    .eq("status", "confirmed")
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
      const ok = await applyRatingForMatch(supabase, m.id, m.format as FormatCode, (m.set_size ?? "d6") as SetCode);
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
 * cliente authenticated. El TS de OpenSkill es el mismo; solo cambia el client.
 */
async function applyRatingForMatch(
  supabase: ReturnType<typeof supabaseService>,
  matchId: string,
  format: FormatCode,
  setSize: SetCode,
): Promise<boolean> {
  const muCol    = ratingCol(setSize, format, "mu");
  const sigmaCol = ratingCol(setSize, format, "sigma");

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team, score")
    .eq("match_id", matchId);
  if (!mps || mps.length === 0) return false;

  const teamScores: Record<number, number> = {};
  for (const r of mps) teamScores[r.team] = (teamScores[r.team] ?? 0) + r.score;

  const userIds = mps.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(`id, ${muCol}, ${sigmaCol}`)
    .in("id", userIds);
  if (!profiles) return false;
  const byId = new Map(profiles.map((p: any) => [p.id, p]));

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

  const { error } = await supabase.rpc("apply_match_rating", {
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

  if (error) {
    console.error("[cron] apply_match_rating RPC failed:", error);
    return false;
  }
  return true;
}
