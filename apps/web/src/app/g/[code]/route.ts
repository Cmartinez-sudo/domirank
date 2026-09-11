// Sprint 1a: /g/<code> — link compartible de grupo.
// Un admin genera el code desde /groups/[id]/members y lo comparte.
// Cualquiera que abra el link:
//   - Si autenticado: se une al grupo (via joinGroupByCode) y redirige a /groups/<id>.
//   - Si no: guarda cookie pending_group_join y redirige a /signup?next=/g/<code>.
//     Tras signup+confirm, el callback consume la cookie y ejecuta la unión.

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { joinGroupByCode } from "@/lib/group-join-code";

const PENDING_GROUP_JOIN_COOKIE = "pending_group_join";
const CODE_RE = /^[a-z0-9]{6,24}$/i;

function currentOrigin(fallback: string): string {
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : fallback;
}

export async function GET(
  request: Request,
  { params }: { params: { code: string } },
) {
  const url = new URL(request.url);
  const origin = currentOrigin(url.origin);
  const code = params.code;

  if (!CODE_RE.test(code)) {
    return NextResponse.redirect(`${origin}/groups?error=invalid_code`);
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    cookies().set(PENDING_GROUP_JOIN_COOKIE, code, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: "lax",
      httpOnly: false,
    });
    return NextResponse.redirect(
      `${origin}/signup?next=${encodeURIComponent(`/g/${code}`)}`,
    );
  }

  const r = await joinGroupByCode({ code });
  if (!r.ok) {
    return NextResponse.redirect(
      `${origin}/groups?error=${encodeURIComponent(r.error)}`,
    );
  }
  return NextResponse.redirect(`${origin}/groups/${r.data!.groupId}`);
}
