"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { friendRequestEmail, friendAcceptedEmail } from "@/lib/email-templates";

/**
 * Envía un email transaccional sin bloquear la operación principal.
 * Cualquier error se loguea y se ignora.
 */
async function notifyByEmail(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  recipientUserId: string,
  buildTemplate: () => { subject: string; html: string; text: string },
) {
  try {
    const { data: email, error } = await supabase.rpc("get_user_email", { p_user_id: recipientUserId });
    if (error) {
      console.warn("[notifyByEmail] get_user_email failed:", error.message);
      return;
    }
    if (!email) return; // opted out or missing
    const tpl = buildTemplate();
    await sendEmail({ to: email, ...tpl });
  } catch (e) {
    console.error("[notifyByEmail] unexpected error:", e);
  }
}

type Result = { ok: true } | { ok: false; error: string };

const Uuid = z.string().uuid();

export async function sendFriendRequest(toUserId: string, message?: string): Promise<Result> {
  const parsed = Uuid.safeParse(toUserId);
  if (!parsed.success) return { ok: false, error: "Usuario inválido" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (user.id === parsed.data) return { ok: false, error: "No puedes pedirte amistad a ti mismo" };

  const limit = await checkLimit(rl.friendReq, `friend:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  // ¿Ya son amigos?
  const { data: existing } = await supabase
    .from("friendships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("friend_id", parsed.data)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya son amigos" };

  // Cargar perfil del sender (para el email template)
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  // ¿Hay request inversa pendiente? Si sí, la aceptamos directamente.
  const { data: inverse } = await supabase
    .from("friend_requests")
    .select("id, status, from_user")
    .eq("from_user", parsed.data)
    .eq("to_user", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (inverse) {
    const { error: ackErr } = await supabase.rpc("accept_friend_request", { req_id: inverse.id });
    if (ackErr) return { ok: false, error: ackErr.message };
    revalidatePath("/friends");
    // Email "tu solicitud fue aceptada" al sender original
    if (senderProfile) {
      void notifyByEmail(supabase, inverse.from_user, () =>
        friendAcceptedEmail({
          fromUsername:    senderProfile.username,
          fromDisplayName: senderProfile.display_name,
        })
      );
    }
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

  // Email "tienes una solicitud" al receptor
  if (senderProfile) {
    void notifyByEmail(supabase, parsed.data, () =>
      friendRequestEmail({
        fromUsername:    senderProfile.username,
        fromDisplayName: senderProfile.display_name,
      })
    );
  }
  return { ok: true };
}

export async function acceptFriendRequest(requestId: string): Promise<Result> {
  const parsed = Uuid.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Request inválido" };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Cargar la request para saber a quién notificar
  const { data: req } = await supabase
    .from("friend_requests")
    .select("from_user, to_user")
    .eq("id", parsed.data)
    .single();

  const { error } = await supabase.rpc("accept_friend_request", { req_id: parsed.data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/friends");

  // Notificar al sender original (yo soy el to_user que acabó de aceptar)
  if (req?.from_user && req?.to_user === user.id) {
    const { data: meProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();
    if (meProfile) {
      void notifyByEmail(supabase, req.from_user, () =>
        friendAcceptedEmail({
          fromUsername:    meProfile.username,
          fromDisplayName: meProfile.display_name,
        })
      );
    }
  }
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
