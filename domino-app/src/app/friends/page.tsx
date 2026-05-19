import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { FriendsPanel } from "./FriendsPanel";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await requireUser();
  const supabase = await supabaseServer();

  // Amigos actuales (con perfil)
  const { data: friendsRaw } = await supabase
    .from("friendships")
    .select("friend_id, created_at, friend:profiles!friendships_friend_id_fkey(id, username, display_name, avatar_url, country)")
    .eq("user_id", user.id);

  // Requests entrantes pendientes
  const { data: incoming } = await supabase
    .from("friend_requests")
    .select("id, message, created_at, from:profiles!friend_requests_from_user_fkey(id, username, display_name, avatar_url, country)")
    .eq("to_user", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Requests salientes pendientes
  const { data: outgoing } = await supabase
    .from("friend_requests")
    .select("id, created_at, to:profiles!friend_requests_to_user_fkey(id, username, display_name, avatar_url, country)")
    .eq("from_user", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const friends = (friendsRaw ?? []).map((r: any) => r.friend).filter(Boolean);

  return (
    <FriendsPanel
      friends={friends}
      incoming={(incoming ?? []) as any}
      outgoing={(outgoing ?? []) as any}
    />
  );
}
