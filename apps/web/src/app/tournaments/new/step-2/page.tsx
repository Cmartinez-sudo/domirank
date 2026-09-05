import { requireOnboardedUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Step2Form } from "./Step2Form";

export const dynamic = "force-dynamic";

type FriendUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

type CurrentUser = FriendUser;

export default async function Step2Page() {
  const user = await requireOnboardedUser();
  const supabase = await supabaseServer();

  // Perfil del organizer (para auto-incluirse en la lista)
  const { data: meProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country")
    .eq("id", user.id)
    .single();

  const me: CurrentUser = {
    id: user.id,
    username: (meProfile as { username?: string | null } | null)?.username ?? "tu",
    display_name: (meProfile as { display_name?: string | null } | null)?.display_name ?? null,
    avatar_url: (meProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    country: (meProfile as { country?: string | null } | null)?.country ?? null,
  };

  // Lista de amigos (mismo query que /friends)
  const { data: friendsRaw } = await supabase
    .from("friendships")
    .select(
      "friend_id, friend:profiles!friendships_friend_id_profiles_fkey(id, username, display_name, avatar_url, country)",
    )
    .eq("user_id", user.id);

  // Supabase typegen modela el join como array aún con !inner; en runtime es un objeto.
  // Normalizamos sin perder type-safety.
  const friends: FriendUser[] = ((friendsRaw ?? []) as unknown as Array<{
    friend: FriendUser | FriendUser[] | null;
  }>)
    .map((r) => (Array.isArray(r.friend) ? r.friend[0] ?? null : r.friend))
    .filter((u): u is FriendUser => u != null);

  return <Step2Form userId={user.id} currentUser={me} friends={friends} />;
}
