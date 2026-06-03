import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vercel Cron — nightly recompute de reliability_score para todos los users
 * con actividad reciente (matches no-cancelled en los últimos 90 días).
 *
 * El trigger trg_reliability_on_match_status (mig 0054) ya mantiene
 * reliability fresh para transiciones confirmed↔otros. Este cron es un
 * safety net para:
 *   • Volume/recency decay: un user que jugó hace 70 días debe ver su
 *     recency caer aunque no haya cambios de status.
 *   • Diversity drift: si un opponent borra su cuenta, diversity baja.
 *   • Self-healing: cualquier inconsistencia por bugs o transacciones
 *     fallidas se corrige nightly.
 *
 * Schedule: 03:30 UTC (offset 30min vs auto-confirm para evitar lock
 * contention en profiles).
 *
 * Protegida con CRON_SECRET via Authorization: Bearer header.
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
  const { data, error } = await supabase.rpc(
    "recompute_reliability_for_active_users",
    { p_days: 90 },
  );

  if (error) {
    console.error("[cron] recompute_reliability_for_active_users failed:", error);
    return NextResponse.json(
      { error: error.message, ts: new Date().toISOString() },
      { status: 500 },
    );
  }

  const usersUpdated = typeof data === "number" ? data : 0;
  const durationMs = Date.now() - startedAt;

  return NextResponse.json({
    usersUpdated,
    durationMs,
    ts: new Date().toISOString(),
  });
}
