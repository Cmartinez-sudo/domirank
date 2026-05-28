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

export default async function FriendsPage() {
  const user = await requireUser();
  const supabase = await supabaseServer();

  // Amigos
  const { data: friendsRaw } = await supabase
    .from("friendships")
    .select("friend_id, created_at, friend:profiles!friendships_friend_id_profiles_fkey(id, username, display_name, avatar_url, country)")
    .eq("user_id", user.id);

  const { data: incoming } = await supabase
    .from("friend_requests")
    .select("id, message, created_at, from:profiles!friend_requests_from_user_profiles_fkey(id, username, display_name, avatar_url, country)")
    .eq("to_user", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: outgoing } = await supabase
    .from("friend_requests")
    .select("id, created_at, to:profiles!friend_requests_to_user_profiles_fkey(id, username, display_name, avatar_url, country)")
    .eq("from_user", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const friends: RawUser[] = (friendsRaw ?? []).map((r: any) => r.friend).filter(Boolean);
  const incomingList = (incoming ?? []) as any[];
  const outgoingList = (outgoing ?? []) as any[];

  const allIds = [
    ...friends.map((f) => f.id),
    ...incomingList.map((r) => r.from?.id).filter(Boolean),
    ...outgoingList.map((r) => r.to?.id).filter(Boolean),
  ];

  // Batch fetch ratings + stats
  const ratingsById = new Map<string, {
    global_display: number | null;
    total_games: number | null;
    total_wins: number | null;
    total_losses: number | null;
  }>();
  if (allIds.length > 0) {
    const { data: ratings } = await supabase
      .from("profile_ratings")
      .select("id, global_display, total_games, d6_singles_wins, d6_singles_losses, d6_doubles_wins, d6_doubles_losses, d9_singles_wins, d9_singles_losses, d9_doubles_wins, d9_doubles_losses")
      .in("id", allIds);
    for (const r of (ratings ?? []) as any[]) {
      const wins = (r.d6_singles_wins ?? 0) + (r.d6_doubles_wins ?? 0) + (r.d9_singles_wins ?? 0) + (r.d9_doubles_wins ?? 0);
      const losses = (r.d6_singles_losses ?? 0) + (r.d6_doubles_losses ?? 0) + (r.d9_singles_losses ?? 0) + (r.d9_doubles_losses ?? 0);
      ratingsById.set(r.id, {
        global_display: r.global_display,
        total_games:    r.total_games,
        total_wins:     wins,
        total_losses:   losses,
      });
    }
  }

  // Batch: última partida confirmed por amigo (solo para mis amigos)
  const lastMatchById = new Map<string, string>();
  if (friends.length > 0) {
    const friendIds = friends.map((f) => f.id);
    const { data: lastMatches } = await supabase
      .from("match_players")
      .select("user_id, created_at, matches!inner(status)")
      .in("user_id", friendIds)
      .eq("matches.status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(200);
    for (const m of (lastMatches ?? []) as any[]) {
      if (!lastMatchById.has(m.user_id)) {
        lastMatchById.set(m.user_id, m.created_at);
      }
    }
  }

  const enrich = (u: RawUser) => ({
    ...u,
    global_display: ratingsById.get(u.id)?.global_display ?? null,
    total_games:    ratingsById.get(u.id)?.total_games    ?? null,
    total_wins:     ratingsById.get(u.id)?.total_wins     ?? null,
    total_losses:   ratingsById.get(u.id)?.total_losses   ?? null,
    last_match_at:  lastMatchById.get(u.id)               ?? null,
  });

  // Stats del viewer para los 3 stat cards (#amigos · #partidas · #pollas)
  let viewerMatchesCount = 0;
  let viewerActivePollasCount = 0;
  try {
    const { count: mc } = await supabase
      .from("match_players")
      .select("match_id, matches!inner(status)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("matches.status", "confirmed");
    viewerMatchesCount = mc ?? 0;

    const { count: pc } = await supabase
      .from("tournaments")
      .select("id, tournament_players!inner(user_id)", { count: "exact", head: true })
      .eq("format", "polla")
      .in("status", ["open", "in_progress"])
      .eq("tournament_players.user_id", user.id);
    viewerActivePollasCount = pc ?? 0;
  } catch (e) {
    console.error("[friends] viewer stats failed:", e);
  }

  return (
    <FriendsPanel
      friends={friends.map(enrich)}
      incoming={incomingList.map((r) => ({ ...r, from: enrich(r.from) })) as any}
      outgoing={outgoingList.map((r) => ({ ...r, to:   enrich(r.to)   })) as any}
      viewerMatchesCount={viewerMatchesCount}
      viewerActivePollasCount={viewerActivePollasCount}
    />
  );
}
