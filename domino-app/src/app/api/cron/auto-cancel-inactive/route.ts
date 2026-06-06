import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron — Sprint Match Cancellation F3.
 *
 * Runs hourly. Two passes:
 *   1. Warning: matches in_progress sin actividad 1h–2h Y sin
 *      inactivity_warning_sent_at → inserta notification
 *      type='match_inactivity_warning' a cada participante. Marca
 *      inactivity_warning_sent_at para no duplicar.
 *   2. Auto-cancel: matches in_progress sin actividad > 2h → llama
 *      cancel_match(p_reason='inactivity_auto'). El RPC inserta
 *      audit + notifications.type='match_cancelled' a otros.
 *
 * Schedule: `0 * * * *` (cada hora). Hobby-plan friendly.
 *
 * Protegido con CRON_SECRET vía header Authorization: Bearer.
 * También aplica el finalize_expired_cancellations RPC para limpiar
 * undo windows vencidas (5min ya pasaron desde un cancel anterior).
 */
export async function GET(request: Request) {
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
  catch {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  const startedAt = Date.now();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();

  // ───── 1. Auto-cancel matches > 2h sin updates ─────
  let cancelledCount = 0;
  const cancelledIds: string[] = [];
  try {
    const { data: cancellable } = await supabase
      .from("matches")
      .select("id")
      .eq("status", "in_progress")
      .lt("updated_at", twoHoursAgo)
      .limit(100);

    for (const m of (cancellable ?? []) as Array<{ id: string }>) {
      const { error } = await supabase.rpc("cancel_match", {
        p_match_id: m.id,
        p_reason: "inactivity_auto",
      });
      if (!error) {
        cancelledCount++;
        cancelledIds.push(m.id);
      } else {
        console.error(`[cron] cancel_match failed for ${m.id}:`, error.message);
      }
    }
  } catch (e) {
    console.error("[cron] auto-cancel loop exception:", e);
  }

  // ───── 2. Warning push para matches 1h-2h sin updates ─────
  let warnedCount = 0;
  try {
    const { data: warnable } = await supabase
      .from("matches")
      .select("id, match_players(user_id)")
      .eq("status", "in_progress")
      .lt("updated_at", oneHourAgo)
      .gt("updated_at", twoHoursAgo)
      .is("inactivity_warning_sent_at", null)
      .limit(100);

    for (const m of (warnable ?? []) as Array<{ id: string; match_players: Array<{ user_id: string }> }>) {
      const participants = (m.match_players ?? []).map((mp) => mp.user_id);
      if (participants.length === 0) continue;

      // In-app notification a cada participante.
      const notifs = participants.map((uid) => ({
        user_id: uid,
        type: "match_inactivity_warning",
        ref_match_id: m.id,
        payload: { match_id: m.id, hours_inactive: 1, will_cancel_at: twoHoursAgo },
      }));
      const { error: notifErr } = await supabase.from("notifications").insert(notifs);
      if (notifErr) {
        console.error(`[cron] notif insert failed for match ${m.id}:`, notifErr.message);
        continue;
      }

      // Mark sent (idempotent).
      const { error: markErr } = await supabase
        .from("matches")
        .update({ inactivity_warning_sent_at: new Date().toISOString() })
        .eq("id", m.id);
      if (markErr) {
        console.error(`[cron] mark warning failed for ${m.id}:`, markErr.message);
      } else {
        warnedCount++;
        // Audit event.
        await supabase.from("match_cancellation_events").insert({
          match_id: m.id,
          action: "warning_sent",
          reason: "1h_inactive",
        });
      }
    }
  } catch (e) {
    console.error("[cron] warning loop exception:", e);
  }

  // ───── 3. Finalize expired undo windows ─────
  let finalizedCount = 0;
  try {
    const { data } = await supabase.rpc("finalize_expired_cancellations");
    finalizedCount = typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[cron] finalize_expired_cancellations failed:", e);
  }

  return NextResponse.json({
    cancelled: cancelledCount,
    cancelledIds,
    warned: warnedCount,
    finalized: finalizedCount,
    durationMs: Date.now() - startedAt,
    ts: new Date().toISOString(),
  });
}
