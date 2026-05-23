import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; user_agent?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { endpoint, keys, user_agent } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Upsert — if the same endpoint already exists for this user, update it.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id:    user.id,
      endpoint,
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      user_agent: user_agent ?? null,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("[push/subscribe] upsert failed:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
