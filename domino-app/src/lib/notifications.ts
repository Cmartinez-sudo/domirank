// Server-side helpers de notifications. NO "use server" porque solo se llaman
// desde Server Components / Server Actions. Si algún día un Client Component
// necesita una mutation, mover esa función a un archivo "use server" separado.

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { NotificationCounts, AppNotification } from "@/lib/notifications-types";

/* ============================================================
   QUERIES
   ============================================================ */

export async function getNotificationCounts(userId: string): Promise<NotificationCounts> {
  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return { unread: count ?? 0 };
}

export async function getNotifications(limit: number = 50): Promise<AppNotification[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, type, payload, ref_match_id, ref_tournament_id, ref_user_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  // Recolectar IDs de actores y request_ids relevantes
  const actorIds   = new Set<string>();
  const requestIds = new Set<string>();
  for (const r of rows) {
    const p = r.payload as any;
    const a = p?.from_user ?? p?.by_user ?? p?.actor_id ?? p?.scorekeeper_id;
    if (a) actorIds.add(a);
    const reqId = p?.request_id;
    if (reqId && r.type === "friend_request_received") requestIds.add(reqId);
  }

  // Batch fetch profiles
  const actors = new Map<string, any>();
  if (actorIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", Array.from(actorIds));
    for (const p of (profiles ?? []) as any[]) actors.set(p.id, p);
  }

  // Batch fetch friend_requests pendientes
  const pending = new Set<string>();
  if (requestIds.size > 0) {
    const { data: reqs } = await supabase
      .from("friend_requests")
      .select("id, status")
      .in("id", Array.from(requestIds))
      .eq("status", "pending");
    for (const req of (reqs ?? []) as any[]) pending.add(req.id);
  }

  return rows.map((r) => {
    const p = r.payload as any;
    const actorId = p?.from_user ?? p?.by_user ?? p?.actor_id ?? p?.scorekeeper_id;
    const reqId   = p?.request_id;
    return {
      id:                 r.id,
      type:               r.type,
      payload:            r.payload as Record<string, string | number | boolean | null>,
      ref_match_id:       (r as any).ref_match_id ?? null,
      ref_tournament_id:  (r as any).ref_tournament_id ?? null,
      ref_user_id:        (r as any).ref_user_id ?? null,
      read_at:            r.read_at,
      created_at:         r.created_at,
      actor:              actorId ? actors.get(actorId) ?? null : null,
      pending_request_id: reqId && r.type === "friend_request_received" && pending.has(reqId)
        ? reqId
        : null,
    } as AppNotification;
  });
}

/* ============================================================
   MUTATIONS
   ============================================================ */

export async function markRead(notificationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
