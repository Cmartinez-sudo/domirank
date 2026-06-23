"use server";

/**
 * Server actions para grupos (Fase C+D #2 — Membership flow).
 *
 * Decisiones vinculantes del grilling 2026-06-22:
 *  - Invitación + aceptación obligatoria (Apple/Play store privacy gap).
 *  - Notificación in-app únicamente (sin email/push).
 *  - Hard-delete del member al rechazar invitación.
 *  - Re-invitación siempre permitida (admin puede invitar a alguien
 *    que estaba left/removed/rejected).
 *  - Solo admin/co_admin invitan; solo creator promote/demote co_admin y
 *    edita settings/desactiva grupo.
 *  - Admin no puede salirse sin transferir (`transferAdmin` cambia
 *    `groups.created_by_user_id` al nuevo admin).
 *  - Límite 100 miembros activos (enforced por trigger en mig 0092).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { groupInvitationEmail } from "@/lib/email-templates";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const NAME_MIN = 2;
const NAME_MAX = 60;
const DESC_MAX = 500;

const UuidSchema = z.string().uuid();

// ─── 1. createGroup ──────────────────────────────────────────

const CreateGroupSchema = z.object({
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
  description: z.string().trim().max(DESC_MAX).optional().or(z.literal("")),
  allowFriendlies: z.boolean().default(true),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export async function createGroup(input: CreateGroupInput): Promise<ActionResult<{ groupId: string }>> {
  const parsed = CreateGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Reusamos el rate limit de torneos — son operaciones de creación equivalentes.
  const limit = await checkLimit(rl.tournament, `group:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  const { data: group, error: insertErr } = await supabase
    .from("groups")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      allow_friendlies: parsed.data.allowFriendlies,
      created_by_user_id: user.id,
    } as never)
    .select("id")
    .single();

  if (insertErr || !group) {
    return { ok: false, error: insertErr?.message ?? "No se pudo crear el grupo" };
  }

  const groupId = (group as { id: string }).id;

  // Auto-add al creator como admin activo (decisión #7).
  const { error: memberErr } = await supabase.from("group_members").insert({
    group_id: groupId,
    user_id: user.id,
    role: "admin",
    status: "active",
    invited_by_user_id: user.id,
    joined_at: new Date().toISOString(),
  } as never);

  if (memberErr) {
    // Rollback best-effort.
    await supabase.from("groups").delete().eq("id", groupId);
    return { ok: false, error: `No se pudo asignar admin: ${memberErr.message}` };
  }

  revalidatePath("/groups");
  return { ok: true, data: { groupId } };
}

// ─── 2. inviteToGroup ────────────────────────────────────────

const InviteSchema = z.object({
  groupId: UuidSchema,
  userId: UuidSchema,
});

/**
 * Invita a un user a un grupo. Solo admins/co_admins (decisión #9).
 *
 * Comportamiento:
 *  - Si no hay fila previa en group_members: INSERT con status='invited'.
 *  - Si hay fila previa (left/removed/rejected/...): UPDATE a status='invited'
 *    para soportar re-invitación (decisión #5).
 *  - Inserta fila en group_invitations (audit log).
 *
 * Bloqueado si el user ya está active (no tiene sentido reinvitar a alguien dentro).
 */
export async function inviteToGroup(input: z.infer<typeof InviteSchema>): Promise<ActionResult<{ invitationId: string }>> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (user.id === parsed.data.userId) {
    return { ok: false, error: "No puedes invitarte a ti mismo" };
  }

  // Validar que el caller es admin o co_admin del grupo.
  const isAdmin = await checkIsGroupAdmin(supabase, user.id, parsed.data.groupId);
  if (!isAdmin) return { ok: false, error: "No tienes permisos para invitar a este grupo" };

  // Verificar que el invitee no esté ya activo.
  const { data: existing } = await supabase
    .from("group_members")
    .select("id, status")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (existing && (existing as { status: string }).status === "active") {
    return { ok: false, error: "Este usuario ya es miembro del grupo" };
  }
  if (existing && (existing as { status: string }).status === "invited") {
    return { ok: false, error: "Este usuario ya tiene una invitación pendiente" };
  }

  // Insertar o actualizar fila en group_members.
  if (existing) {
    // Reactivar fila previa (left/removed/rejected).
    const { error: updateErr } = await supabase
      .from("group_members")
      .update({
        status: "invited",
        invited_by_user_id: user.id,
        invited_at: new Date().toISOString(),
        joined_at: null,
        left_at: null,
      } as never)
      .eq("id", (existing as { id: string }).id);
    if (updateErr) return { ok: false, error: updateErr.message };
  } else {
    const { error: insertErr } = await supabase.from("group_members").insert({
      group_id: parsed.data.groupId,
      user_id: parsed.data.userId,
      role: "member",
      status: "invited",
      invited_by_user_id: user.id,
    } as never);
    if (insertErr) {
      // Race: dos admins invitando al mismo user simultáneamente. El primero
      // pasa el check `existing=null` e INSERTA; el segundo también, y falla
      // por UNIQUE (group_id, user_id). Mensaje user-friendly.
      const code = (insertErr as { code?: string }).code;
      if (code === "23505") {
        return { ok: false, error: "Este usuario ya tiene una invitación pendiente" };
      }
      if (insertErr.message.includes("group_member_limit_reached")) {
        return { ok: false, error: "El grupo ya tiene 100 miembros activos." };
      }
      return { ok: false, error: insertErr.message };
    }
  }

  // Insertar invitación (audit log) — UPSERT por si quedó una vieja.
  const { data: invitation, error: invErr } = await supabase
    .from("group_invitations")
    .insert({
      group_id: parsed.data.groupId,
      invited_user_id: parsed.data.userId,
      invited_by_user_id: user.id,
      status: "pending",
    } as never)
    .select("id")
    .single();

  if (invErr || !invitation) {
    // Mismo race que arriba pero sobre group_invitations (UNIQUE constraint
    // si existe). El primer caller ganó; este pierde.
    const code = (invErr as { code?: string } | null)?.code;
    if (code === "23505") {
      return { ok: false, error: "Este usuario ya tiene una invitación pendiente" };
    }
    return { ok: false, error: invErr?.message ?? "No se pudo crear la invitación" };
  }

  // Notificación por email (Fase C+D #6). Best-effort: si falla, la
  // invitación in-app ya está creada. La invitación se ve igual al entrar
  // a /groups, así que el email es "bonus" para usuarios no logueados.
  await sendInvitationEmail(supabase, {
    inviterId: user.id,
    inviteeId: parsed.data.userId,
    groupId: parsed.data.groupId,
  }).catch((e) => {
    console.error("[inviteToGroup] email send failed:", e);
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true, data: { invitationId: (invitation as { id: string }).id } };
}

/**
 * Envía el email de invitación al grupo (Fase C+D #6).
 *
 * Best-effort:
 *  - Si `get_user_email` falla o devuelve null (user opted-out), no manda nada.
 *  - Si falta data del grupo/inviter, log y skip.
 *  - Si Resend rechaza, log y skip — la operación principal no se afecta.
 */
async function sendInvitationEmail(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  { inviterId, inviteeId, groupId }: { inviterId: string; inviteeId: string; groupId: string },
): Promise<void> {
  // Email del invitado.
  const { data: email, error: emailErr } = await supabase.rpc("get_user_email", {
    p_user_id: inviteeId,
  } as never);
  if (emailErr) {
    console.warn("[sendInvitationEmail] get_user_email failed:", emailErr.message);
    return;
  }
  if (!email) return; // opted out o sin email

  // Datos del invitador.
  const { data: inviter } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", inviterId)
    .maybeSingle();
  if (!inviter) {
    console.warn("[sendInvitationEmail] inviter profile not found");
    return;
  }
  const i = inviter as { username: string; display_name: string | null; avatar_url: string | null };

  // Datos del grupo.
  const { data: group } = await supabase
    .from("groups")
    .select("name, description")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) {
    console.warn("[sendInvitationEmail] group not found");
    return;
  }
  const g = group as { name: string; description: string | null };

  // Conteo de miembros activos.
  const { count: activeCount } = await supabase
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active");

  const template = groupInvitationEmail({
    inviterUsername: i.username,
    inviterDisplayName: i.display_name,
    inviterAvatarUrl: i.avatar_url,
    groupName: g.name,
    groupDescription: g.description,
    activeMembersCount: activeCount ?? 0,
  });

  await sendEmail({ to: email as string, ...template });
}

// ─── 3. acceptInvitation ─────────────────────────────────────

const InvitationIdSchema = z.object({ invitationId: UuidSchema });

export async function acceptInvitation(input: z.infer<typeof InvitationIdSchema>): Promise<ActionResult> {
  const parsed = InvitationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: invitation } = await supabase
    .from("group_invitations")
    .select("id, group_id, invited_user_id, status")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "Invitación no encontrada" };
  const inv = invitation as { id: string; group_id: string; invited_user_id: string; status: string };
  if (inv.invited_user_id !== user.id) return { ok: false, error: "Esta invitación no es para ti" };
  if (inv.status !== "pending") return { ok: false, error: "Esta invitación ya no está pendiente" };

  // Update invitation + member en paralelo (no son atómicas pero el riesgo es bajo).
  const now = new Date().toISOString();

  const { error: invUpdErr } = await supabase
    .from("group_invitations")
    .update({ status: "accepted", responded_at: now } as never)
    .eq("id", inv.id);
  if (invUpdErr) return { ok: false, error: invUpdErr.message };

  const { error: memUpdErr } = await supabase
    .from("group_members")
    .update({ status: "active", joined_at: now } as never)
    .eq("group_id", inv.group_id)
    .eq("user_id", user.id);
  if (memUpdErr) {
    if (memUpdErr.message.includes("group_member_limit_reached")) {
      // Revertir invitación.
      await supabase
        .from("group_invitations")
        .update({ status: "pending", responded_at: null } as never)
        .eq("id", inv.id);
      return { ok: false, error: "El grupo ya alcanzó el límite de 100 miembros." };
    }
    return { ok: false, error: memUpdErr.message };
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${inv.group_id}`);
  return { ok: true };
}

// ─── 4. rejectInvitation ─────────────────────────────────────

export async function rejectInvitation(input: z.infer<typeof InvitationIdSchema>): Promise<ActionResult> {
  const parsed = InvitationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: invitation } = await supabase
    .from("group_invitations")
    .select("id, group_id, invited_user_id, status")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "Invitación no encontrada" };
  const inv = invitation as { id: string; group_id: string; invited_user_id: string; status: string };
  if (inv.invited_user_id !== user.id) return { ok: false, error: "Esta invitación no es para ti" };
  if (inv.status !== "pending") return { ok: false, error: "Esta invitación ya no está pendiente" };

  // Update invitation + DELETE member row (decisión #3 hard-delete).
  const { error: invUpdErr } = await supabase
    .from("group_invitations")
    .update({ status: "rejected", responded_at: new Date().toISOString() } as never)
    .eq("id", inv.id);
  if (invUpdErr) return { ok: false, error: invUpdErr.message };

  const { error: delErr } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", inv.group_id)
    .eq("user_id", user.id);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/groups");
  return { ok: true };
}

// ─── 4b. cancelInvitation ────────────────────────────────────

/**
 * Admin cancela una invitación pendiente que él envió.
 *
 * Fase C+D #4 (UI views): el botón "Cancelar invitación" en la pantalla
 * de miembros usa este action. Operaciones:
 *   - UPDATE group_invitations.status='expired', responded_at=now()
 *   - DELETE de group_members (la fila invited).
 */
export async function cancelInvitation(input: z.infer<typeof InvitationIdSchema>): Promise<ActionResult> {
  const parsed = InvitationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: invitation } = await supabase
    .from("group_invitations")
    .select("id, group_id, invited_user_id, status")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "Invitación no encontrada" };
  const inv = invitation as { id: string; group_id: string; invited_user_id: string; status: string };
  if (inv.status !== "pending") return { ok: false, error: "Esta invitación ya no está pendiente" };

  // Solo admins/co_admins del grupo pueden cancelar.
  const isAdmin = await checkIsGroupAdmin(supabase, user.id, inv.group_id);
  if (!isAdmin) return { ok: false, error: "No tienes permisos para cancelar invitaciones" };

  const { error: invErr } = await supabase
    .from("group_invitations")
    .update({ status: "expired", responded_at: new Date().toISOString() } as never)
    .eq("id", inv.id);
  if (invErr) return { ok: false, error: invErr.message };

  const { error: delErr } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", inv.group_id)
    .eq("user_id", inv.invited_user_id);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath(`/groups/${inv.group_id}`);
  return { ok: true };
}

// ─── 5. leaveGroup ───────────────────────────────────────────

const GroupIdSchema = z.object({ groupId: UuidSchema });

export async function leaveGroup(input: z.infer<typeof GroupIdSchema>): Promise<ActionResult> {
  const parsed = GroupIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: member } = await supabase
    .from("group_members")
    .select("id, role, status")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return { ok: false, error: "No eres miembro de este grupo" };
  const m = member as { id: string; role: string; status: string };
  if (m.status !== "active") return { ok: false, error: "No eres miembro activo" };

  // Decisión #11: admin no se puede salir sin transferir el rol.
  if (m.role === "admin") {
    return {
      ok: false,
      error: "Eres admin del grupo. Transfiere el rol a otro miembro antes de salir.",
    };
  }

  const { error: updErr } = await supabase
    .from("group_members")
    .update({ status: "left", left_at: new Date().toISOString() } as never)
    .eq("id", m.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/groups");
  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── 6. removeMember ─────────────────────────────────────────

const RemoveMemberSchema = z.object({
  groupId: UuidSchema,
  userId: UuidSchema,
});

/**
 * Jerarquía (decisión #10):
 *   - admin saca co_admin o member.
 *   - co_admin saca solo members.
 *   - Nadie se puede sacar a sí mismo (usar leaveGroup).
 */
export async function removeMember(input: z.infer<typeof RemoveMemberSchema>): Promise<ActionResult> {
  const parsed = RemoveMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (user.id === parsed.data.userId) {
    return { ok: false, error: "Usa 'salir del grupo' para sacarte a ti mismo" };
  }

  // Validar caller role.
  const { data: caller } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  const c = caller as { role: string; status: string } | null;
  if (!c || c.status !== "active" || !["admin", "co_admin"].includes(c.role)) {
    return { ok: false, error: "No tienes permisos para sacar miembros" };
  }

  // Validar target role.
  const { data: target } = await supabase
    .from("group_members")
    .select("id, role, status")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  const t = target as { id: string; role: string; status: string } | null;
  if (!t || t.status !== "active") return { ok: false, error: "Ese usuario no es miembro activo" };

  // Co_admin solo puede sacar members.
  if (c.role === "co_admin" && t.role !== "member") {
    return { ok: false, error: "Co-admins solo pueden sacar a miembros" };
  }
  // Admin puede sacar co_admin o member, pero no a otro admin (no debería existir).
  if (t.role === "admin") {
    return { ok: false, error: "No se puede sacar al admin del grupo" };
  }

  const { error: updErr } = await supabase
    .from("group_members")
    .update({ status: "removed", left_at: new Date().toISOString() } as never)
    .eq("id", t.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── 7. promoteCoAdmin ───────────────────────────────────────

const RoleChangeSchema = z.object({
  groupId: UuidSchema,
  userId: UuidSchema,
});

/**
 * Solo el creator (`groups.created_by_user_id = auth.uid()`) puede promover.
 */
export async function promoteCoAdmin(input: z.infer<typeof RoleChangeSchema>): Promise<ActionResult> {
  return changeRole(input, "co_admin", "member");
}

// ─── 8. demoteCoAdmin ────────────────────────────────────────

export async function demoteCoAdmin(input: z.infer<typeof RoleChangeSchema>): Promise<ActionResult> {
  return changeRole(input, "member", "co_admin");
}

async function changeRole(
  input: z.infer<typeof RoleChangeSchema>,
  newRole: "co_admin" | "member",
  expectedCurrent: "member" | "co_admin",
): Promise<ActionResult> {
  const parsed = RoleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Solo creator del grupo (decisión #10 dim 2 = e).
  const { data: group } = await supabase
    .from("groups")
    .select("created_by_user_id")
    .eq("id", parsed.data.groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo no encontrado" };
  if ((group as { created_by_user_id: string }).created_by_user_id !== user.id) {
    return { ok: false, error: "Solo el admin del grupo puede cambiar roles" };
  }

  const { data: target } = await supabase
    .from("group_members")
    .select("id, role, status")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  const t = target as { id: string; role: string; status: string } | null;
  if (!t || t.status !== "active") return { ok: false, error: "Ese usuario no es miembro activo" };
  if (t.role !== expectedCurrent) {
    return { ok: false, error: `El usuario debe ser ${expectedCurrent} para esta operación (es ${t.role})` };
  }

  const { error: updErr } = await supabase
    .from("group_members")
    .update({ role: newRole } as never)
    .eq("id", t.id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── 9. transferAdmin ────────────────────────────────────────

const TransferAdminSchema = z.object({
  groupId: UuidSchema,
  newAdminUserId: UuidSchema,
});

/**
 * Transfiere el rol de admin del creator actual a otro miembro.
 *
 * Operaciones (decisión #12):
 *  1. `groups.created_by_user_id` ← newAdminUserId
 *  2. role del nuevo: admin
 *  3. role del viejo: member
 *
 * El viejo admin sigue siendo member del grupo (NO se va automáticamente).
 * Si quiere salirse, llama leaveGroup() después.
 */
export async function transferAdmin(input: z.infer<typeof TransferAdminSchema>): Promise<ActionResult> {
  const parsed = TransferAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (user.id === parsed.data.newAdminUserId) {
    return { ok: false, error: "Ya eres el admin del grupo" };
  }

  // Las 3 mutations (groups.created_by + role nuevo admin + role viejo admin)
  // corren atómicamente dentro de transfer_group_admin (SECURITY DEFINER,
  // migración 0096). Si cualquiera falla, todas revierten. Issue #1 del review.
  const { error: rpcErr } = await supabase.rpc("transfer_group_admin", {
    p_group_id: parsed.data.groupId,
    p_new_admin_id: parsed.data.newAdminUserId,
  } as never);

  if (rpcErr) {
    // Mapear los exceptions de la función SQL a mensajes user-friendly.
    const msg = rpcErr.message ?? "";
    if (msg.includes("group_not_found")) {
      return { ok: false, error: "Grupo no encontrado" };
    }
    if (msg.includes("only_creator_can_transfer")) {
      return { ok: false, error: "Solo el admin del grupo puede transferir el rol" };
    }
    if (msg.includes("already_admin")) {
      return { ok: false, error: "Ya eres el admin del grupo" };
    }
    if (msg.includes("new_admin_not_active_member")) {
      return { ok: false, error: "El nuevo admin debe ser miembro activo del grupo" };
    }
    return { ok: false, error: rpcErr.message };
  }

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── 10. updateGroupSettings ─────────────────────────────────

const UpdateGroupSettingsSchema = z.object({
  groupId: UuidSchema,
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX).optional(),
  description: z.string().trim().max(DESC_MAX).optional().or(z.literal("")),
  allowFriendlies: z.boolean().optional(),
});

/**
 * Solo el creator/admin (decisión #13 dim 1 = a).
 */
export async function updateGroupSettings(input: z.infer<typeof UpdateGroupSettingsSchema>): Promise<ActionResult> {
  const parsed = UpdateGroupSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: group } = await supabase
    .from("groups")
    .select("created_by_user_id, is_active")
    .eq("id", parsed.data.groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo no encontrado" };
  const g = group as { created_by_user_id: string; is_active: boolean };
  if (g.created_by_user_id !== user.id) {
    return { ok: false, error: "Solo el admin del grupo puede editar la configuración" };
  }
  if (!g.is_active) return { ok: false, error: "El grupo está desactivado" };

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description || null;
  if (parsed.data.allowFriendlies !== undefined) update.allow_friendlies = parsed.data.allowFriendlies;

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "No hay cambios para guardar" };
  }

  const { error: updErr } = await supabase
    .from("groups")
    .update(update as never)
    .eq("id", parsed.data.groupId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── 11. deactivateGroup ─────────────────────────────────────

/**
 * Soft-delete del grupo (decisión #13 dim 2 = c). Solo el creator.
 */
export async function deactivateGroup(input: z.infer<typeof GroupIdSchema>): Promise<ActionResult> {
  const parsed = GroupIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: group } = await supabase
    .from("groups")
    .select("created_by_user_id, is_active")
    .eq("id", parsed.data.groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo no encontrado" };
  const g = group as { created_by_user_id: string; is_active: boolean };
  if (g.created_by_user_id !== user.id) {
    return { ok: false, error: "Solo el admin del grupo puede desactivarlo" };
  }
  if (!g.is_active) return { ok: false, error: "El grupo ya está desactivado" };

  const { error: updErr } = await supabase
    .from("groups")
    .update({ is_active: false } as never)
    .eq("id", parsed.data.groupId);
  if (updErr) return { ok: false, error: updErr.message };

  // Higiene: expirar invitaciones pending del grupo desactivado (issue #9 del
  // review). Sin esto, las invitaciones quedaban huérfanas en BD aunque la
  // query `listMyInvitations` ya las filtraba por groups.is_active=true.
  // Best-effort: si falla, log y seguimos — el grupo ya está desactivado.
  const { error: invExpireErr } = await supabase
    .from("group_invitations")
    .update({ status: "expired", responded_at: new Date().toISOString() } as never)
    .eq("group_id", parsed.data.groupId)
    .eq("status", "pending");
  if (invExpireErr) {
    console.warn("[deactivateGroup] expire invitations failed:", invExpireErr.message);
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${parsed.data.groupId}`);
  return { ok: true };
}

// ─── Helpers internos ────────────────────────────────────────

/**
 * Wrapper para is_group_admin() SQL helper (definido en mig 0086).
 * Lo llamamos via RPC para evitar duplicar la lógica en TS.
 */
async function checkIsGroupAdmin(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_group_admin", {
    p_user_id: userId,
    p_group_id: groupId,
  } as never);
  if (error) return false;
  return data === true;
}
