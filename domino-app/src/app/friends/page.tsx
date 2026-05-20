import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { FriendsPanel } from "./FriendsPanel";

export const dynamic = "force-dynamic";

type RawUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};
type EnrichedUser = RawUser & { global_display: number | null; total_games: number | null };

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

  const friends: RawUser[] = (friendsRaw ?? []).map((r: any) => r.friend).filter(Boolean);
  const incomingList = (incoming ?? []) as any[];
  const outgoingList = (outgoing ?? []) as any[];

  // Enriquecer con ratings (single batch query)
  const allIds = [
    ...friends.map((f) => f.id),
    ...incomingList.map((r) => r.from?.id).filter(Boolean),
    ...outgoingList.map((r) => r.to?.id).filter(Boolean),
  ];

  let ratingsById = new Map<string, { global_display: number | null; total_games: number | null }>();
  if (allIds.length > 0) {
    const { data: ratings } = await supabase
      .from("profile_ratings")
      .select("id, global_display, total_games")
      .in("id", allIds);
    for (const r of (ratings ?? []) as any[]) {
      ratingsById.set(r.id, { global_display: r.global_display, total_games: r.total_games });
    }
  }

  const enrich = (u: RawUser): EnrichedUser => ({
    ...u,
    global_display: ratingsById.get(u.id)?.global_display ?? null,
    total_games:    ratingsById.get(u.id)?.total_games    ?? null,
  });

  return (
    <FriendsPanel
      friends={friends.map(enrich)}
      incoming={incomingList.map((r) => ({ ...r, from: enrich(r.from) })) as any}
      outgoing={outgoingList.map((r) => ({ ...r, to:   enrich(r.to)   })) as any}
    />
  );
}
