import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { pushUnsubscribeSchema, MAX_PUSH_BODY_BYTES } from "@/lib/push-schema";
import { rl, checkLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PUSH_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const limit = await checkLimit(rl.push, `push:${user.id}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.error }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = pushUnsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const { endpoint } = parsed.data;

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push/unsubscribe] delete failed:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
