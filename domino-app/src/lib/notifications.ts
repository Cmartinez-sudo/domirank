import { supabaseServer } from "@/lib/supabase/server";

/**
 * Conteos de notificaciones para badges en el nav. Se llama desde el root
 * layout en cada render — la queries son baratas (count exact head=true).
 */

export type NotificationCounts = {
  friendRequests: number;
};

export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  const supabase = await supabaseServer();

  const { count } = await supabase
    .from("friend_requests")
    .select("*", { count: "exact", head: true })
    .eq("to_user", userId)
    .eq("status", "pending");

  return {
    friendRequests: count ?? 0,
  };
}
