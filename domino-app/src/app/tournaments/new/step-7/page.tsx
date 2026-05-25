import { requireOnboardedUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Step7Form } from "./Step7Form";

export const dynamic = "force-dynamic";

export default async function Step7Page() {
  const user = await requireOnboardedUser();
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country")
    .eq("id", user.id)
    .single();

  const currentUser = {
    id: user.id,
    username: (profile as any)?.username ?? "",
    display_name: (profile as any)?.display_name ?? null,
    avatar_url: (profile as any)?.avatar_url ?? null,
    country: (profile as any)?.country ?? null,
  };

  return <Step7Form userId={user.id} currentUser={currentUser} />;
}
