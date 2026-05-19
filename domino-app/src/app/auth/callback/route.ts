import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Después de iniciar sesión decidimos a dónde ir:
      //   - si el usuario no completó onboarding → /onboarding
      //   - si pidió un next explícito → respetarlo
      //   - default → /dashboard
      const { data: { user } } = await supabase.auth.getUser();
      let target = requestedNext ?? "/dashboard";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded")
          .eq("id", user.id)
          .single();
        if (profile && profile.onboarded === false) {
          target = "/onboarding";
        }
      }
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
