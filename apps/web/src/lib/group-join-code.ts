"use server";

// Sprint 1a: Link compartible de grupo (`/g/<code>`).
// El admin/co_admin genera un `join_code`, lo comparte por WhatsApp;
// quien abre el link (autenticado o no) queda como member activo del
// grupo — respetando el límite de 100 miembros y RLS existentes.
//
// Nunca genera desde el DB (no queremos triggers acoplados a nanoid);
// siempre server-side. Rotación revoca el viejo (UNIQUE constraint).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { checkAndFireFirstValuableAction } from "@/lib/activation";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const UuidSchema = z.string().uuid();
const CodeSchema = z.string().min(6).max(24).regex(/^[a-z0-9]+$/i);

const JOIN_CODE_TTL_DAYS = 30;

/**
 * Genera nanoid-like code de 10 chars alfanuméricos [a-z0-9].
 * URL-safe, colisión práctica ~cero para escalas <1M grupos.
 */
function generateCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}

async function checkIsGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  const svc = supabaseService();
  const { data } = await svc.rpc("is_group_admin", {
    p_user_id: userId,
    p_group_id: groupId,
  } as never);
  return data === true;
}

// ─── 1. createOrRotateJoinCode ────────────────────────────────

/**
 * Crea un join_code para el grupo (o lo rota si ya había uno).
 * Solo admin/co_admin. TTL 30 días desde ahora.
 */
export async function createOrRotateJoinCode(
  input: { groupId: string },
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  const parsed = z.object({ groupId: UuidSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const authClient = await supabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const isAdmin = await checkIsGroupAdmin(user.id, parsed.data.groupId);
  if (!isAdmin) return { ok: false, error: "No tienes permisos para gestionar el link" };

  const svc = supabaseService();

  // Reintentar hasta 3 veces en caso de colisión UNIQUE.
  let attempts = 0;
  let code = generateCode();
  let expiresAt = new Date(Date.now() + JOIN_CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  while (attempts < 3) {
    const { error } = await svc
      .from("groups")
      .update({
        join_code: code,
        join_code_expires_at: expiresAt,
      } as never)
      .eq("id", parsed.data.groupId);

    if (!error) {
      revalidatePath(`/groups/${parsed.data.groupId}`);
      revalidatePath(`/groups/${parsed.data.groupId}/members`);
      return { ok: true, data: { code, expiresAt } };
    }

    const dbCode = (error as { code?: string }).code;
    if (dbCode === "23505") {
      // Colisión — regenerar.
      attempts++;
      code = generateCode();
      expiresAt = new Date(Date.now() + JOIN_CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      continue;
    }
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "No se pudo generar el código (colisiones repetidas)" };
}

// ─── 2. disableJoinCode ───────────────────────────────────────

export async function disableJoinCode(input: { groupId: string }): Promise<ActionResult> {
  const parsed = z.object({ groupId: UuidSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const authClient = await supabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const isAdmin = await checkIsGroupAdmin(user.id, parsed.data.groupId);
  if (!isAdmin) return { ok: false, error: "No tienes permisos para gestionar el link" };

  const svc = supabaseService();
  const { error } = await svc
    .from("groups")
    .update({ join_code: null, join_code_expires_at: null } as never)
    .eq("id", parsed.data.groupId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath(`/groups/${parsed.data.groupId}/members`);
  return { ok: true };
}

// ─── 3. joinGroupByCode ───────────────────────────────────────

/**
 * Self-join a grupo por código. Llamado desde el route handler /g/[code]
 * cuando el usuario está autenticado. No es un action de UI — la UI llega
 * al grupo tras redirect.
 *
 * Comportamiento:
 *   - Si ya es miembro active: no-op, retorna groupId.
 *   - Si tiene fila status IN (invited, left, removed, rejected): UPDATE a active.
 *   - Si no tiene fila: INSERT status='active', role='member'.
 *   - Si el grupo está lleno (100 miembros): error (trigger existente lo bloquea).
 *   - Si el code expiró o no existe: error.
 */
export async function joinGroupByCode(input: { code: string }): Promise<ActionResult<{
  groupId: string;
  alreadyMember: boolean;
}>> {
  const parsed = z.object({ code: CodeSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Código inválido" };

  const authClient = await supabaseServer();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const svc = supabaseService();

  // Buscar grupo por código, verificar expiración.
  const { data: group } = await svc
    .from("groups")
    .select("id, join_code_expires_at, is_active, created_by_user_id")
    .eq("join_code", parsed.data.code)
    .maybeSingle();

  if (!group) return { ok: false, error: "Este link ya no es válido" };
  const g = group as { id: string; join_code_expires_at: string | null; is_active: boolean; created_by_user_id: string };
  if (!g.is_active) return { ok: false, error: "El grupo ya no está activo" };
  if (g.join_code_expires_at && new Date(g.join_code_expires_at) < new Date()) {
    return { ok: false, error: "Este link expiró. Pide al admin que genere uno nuevo." };
  }

  // Verificar membership existente.
  const { data: existing } = await svc
    .from("group_members")
    .select("id, status")
    .eq("group_id", g.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const e = existing as { id: string; status: string };
    if (e.status === "active") {
      return { ok: true, data: { groupId: g.id, alreadyMember: true } };
    }
    // Reactivar (o convertir invited → active).
    const { error: updErr } = await svc
      .from("group_members")
      .update({
        status: "active",
        joined_at: new Date().toISOString(),
        left_at: null,
      } as never)
      .eq("id", e.id);
    if (updErr) {
      if (updErr.message.includes("group_member_limit_reached")) {
        return { ok: false, error: "El grupo ya tiene 100 miembros activos." };
      }
      return { ok: false, error: updErr.message };
    }
    await fireGroupFVAIfCrossedThreshold(svc, g.id, g.created_by_user_id);
    revalidatePath(`/groups/${g.id}`);
    revalidatePath("/groups");
    return { ok: true, data: { groupId: g.id, alreadyMember: false } };
  }

  // Insert nuevo member.
  const { error: insertErr } = await svc
    .from("group_members")
    .insert({
      group_id: g.id,
      user_id: user.id,
      role: "member",
      status: "active",
      invited_by_user_id: user.id, // self-join
      joined_at: new Date().toISOString(),
    } as never);

  if (insertErr) {
    if (insertErr.message.includes("group_member_limit_reached")) {
      return { ok: false, error: "El grupo ya tiene 100 miembros activos." };
    }
    return { ok: false, error: insertErr.message };
  }

  await fireGroupFVAIfCrossedThreshold(svc, g.id, g.created_by_user_id);
  revalidatePath(`/groups/${g.id}`);
  revalidatePath("/groups");
  return { ok: true, data: { groupId: g.id, alreadyMember: false } };
}

async function fireGroupFVAIfCrossedThreshold(
  svc: ReturnType<typeof supabaseService>,
  groupId: string,
  creatorId: string,
): Promise<void> {
  const { count } = await svc
    .from("group_members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active");
  if ((count ?? 0) >= 2) {
    await checkAndFireFirstValuableAction(creatorId, "group_with_member").catch((e) => {
      console.warn("[joinGroupByCode] FVA failed:", e);
    });
  }
}
