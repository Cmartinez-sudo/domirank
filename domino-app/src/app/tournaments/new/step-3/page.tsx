import { requireOnboardedUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Step3Form } from "./Step3Form";

export const dynamic = "force-dynamic";

type MiniUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

export default async function Step3Page() {
  const user = await requireOnboardedUser();
  const supabase = await supabaseServer();

  const { data: meProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country")
    .eq("id", user.id)
    .single();

  const me: MiniUser = {
    id: user.id,
    username: (meProfile as { username?: string | null } | null)?.username ?? "tu",
    display_name: (meProfile as { display_name?: string | null } | null)?.display_name ?? null,
    avatar_url: (meProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    country: (meProfile as { country?: string | null } | null)?.country ?? null,
  };

  return <Step3Form userId={user.id} currentUser={me} />;
}
