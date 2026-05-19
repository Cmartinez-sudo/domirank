"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const Uuid = z.string().uuid();

export async function sendFriendRequest(toUserId: string, message?: string): Promise<Result> {
  const parsed = Uuid.safeParse(toUserId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (user.id === parsed.data) return { ok: false, error: "No puedes pedirte amistad a ti mismo" };

  // ¿Ya son amigos?
  const { data: existing } = await supabase
    .from("friendships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("friend_id", parsed.data)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya son amigos" };

  // ¿Hay request inversa pendiente? Si sí, la aceptamos directamente.
  const { data: inverse } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user", parsed.data)
    .eq("to_user", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (inverse) {
    const { error: ackErr } = await supabase.rpc("accept_friend_request", { req_id: inverse.id });
    if (ackErr) return { ok: false, error: ackErr.message };
    revalidatePath("/friends");
    return { ok: true };
  }

  // Upsert para manejar request previa rechazada/cancelada
  const { error } = await supabase
    .from("friend_requests")
    .upsert(
      { from_user: user.id, to_user: parsed.data, status: "pending", message: message ?? null, responded_at: null },
      { onConflict: "from_user,to_user" }
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");
  return { ok: true };
}

export async function acceptFriendRequest(requestId: string): Promise<Result> {
  const parsed = Uuid.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Request inválido" };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("accept_friend_request", { req_id: parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");
  return { ok: true };
}

export async function rejectFriendRequest(requestId: string): Promise<Result> {
  const parsed = Uuid.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Request inválido" };
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");
  return { ok: true };
}

export async function cancelFriendRequest(requestId: string): Promise<Result> {
  const parsed = Uuid.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Request inválido" };
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");
  return { ok: true };
}

export async function unfriend(otherUserId: string): Promise<Result> {
  const parsed = Uuid.safeParse(otherUserId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("unfriend", { other_user: parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");
  return { ok: true };
}

/**
 * Estado de relación con otro usuario (para botón en perfil ajeno).
 */
export type RelationStatus =
  | { kind: "self" }
  | { kind: "friends" }
  | { kind: "outgoing_pending"; requestId: string }
  | { kind: "incoming_pending"; requestId: string }
  | { kind: "none" };

export async function getRelationStatus(otherUserId: string): Promise<RelationStatus> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "none" };
  if (user.id === otherUserId) return { kind: "self" };

  const { data: f } = await supabase
    .from("friendships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("friend_id", otherUserId)
    .maybeSingle();
  if (f) return { kind: "friends" };

  const { data: out } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user", user.id)
    .eq("to_user", otherUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (out) return { kind: "outgoing_pending", requestId: out.id };

  const { data: inc } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user", otherUserId)
    .eq("to_user", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (inc) return { kind: "incoming_pending", requestId: inc.id };

  return { kind: "none" };
}
