"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/* ============================================================
   TIPOS
   ============================================================ */

export type NotificationCounts = {
  /** Total de notificaciones no leídas — alimenta el bell badge */
  unread: number;
};

export type NotificationType = "friend_request_received" | "friend_request_accepted" | string;

export type AppNotification = {
  id: string;
  type: NotificationType;
  payload: Record<string, any>;
  ref_match_id: string | null;
  read_at: string | null;
  created_at: string;
  /** Perfil del usuario relevante (sender, actor, scorekeeper) si aplica */
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  /**
   * Para friend_request_received: si la request sigue pendiente, request_id
   * apunta a ella. Si ya fue respondida, es null.
   */
  pending_request_id: string | null;
};

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
    .select("id, type, payload, ref_match_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  // Recolectar IDs de actores y request_ids relevantes (una query cada uno)
  const actorIds  = new Set<string>();
  const requestIds = new Set<string>();
  for (const r of rows) {
    const p = r.payload as any;
    // Distintos tipos usan distintos campos para el "actor"
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

  // Batch fetch friend_requests status (para saber cuáles siguen pendientes)
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
      payload:            r.payload as Record<string, any>,
      ref_match_id:       (r as any).ref_match_id ?? null,
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
