import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/privacy/opt-out-analytics
 *
 * Endpoint stub de opt-out de analytics.
 * HOY: solo verifica autenticación y retorna ok.
 *
 * Para implementar opt-out completo (scope post-sprint — ver TECH_DEBT.md):
 *   a) Extender tabla `user_preferences` con campo `analytics_opted_out boolean DEFAULT false`.
 *   b) Actualizar el campo aquí via supabase.from("user_preferences").upsert(...).
 *   c) Leer el flag en AnalyticsProvider y llamar posthog.opt_out_capturing() si está true.
 *   El opt-out real client-side requiere llamar posthog.opt_out_capturing()
 *   desde un Client Component al recibir respuesta ok de este endpoint.
 */
export async function POST() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "auth_required" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
