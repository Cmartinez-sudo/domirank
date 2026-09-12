// Sprint 1b: recibe beacons de onboarding_abandoned al cerrar tab.
// Solo logea al console; PostHog no tiene SDK server-side wired.
// TODO(sprint2): posthog server SDK para agregar el evento authoritative-side.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { step?: string; sub_step?: number | null }
      | null;

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    console.log(
      "[onboarding_abandoned]",
      "user:", user?.id ?? "anon",
      "step:", body?.step,
      "sub_step:", body?.sub_step,
    );
  } catch (e) {
    console.warn("[onboarding_abandoned] beacon parse failed:", e);
  }
  return new NextResponse(null, { status: 204 });
}
