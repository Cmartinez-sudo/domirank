/**
 * Unit tests para src/lib/groups.ts (Fase C+D #2).
 *
 * Mocks: supabaseServer + ratelimit. Verifican validación de permisos,
 * transiciones de status y casos edge (admin se intenta salir, member
 * intenta sacar a otro, transferir admin, etc.).
 *
 * Patrón de mocks copiado de user-preferences-actions.test.ts. La factory
 * de vi.mock no puede usar variables externas (hoisting), así que cada
 * test reinicia el comportamiento de los mocks en beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
//
// Construimos un "query builder" mock que soporta:
//   .select(...).eq(...).eq(...).maybeSingle() → data
//   .insert(...).select(...).single() → data
//   .update(...).eq(...) → { error }
//   .delete().eq(...) → { error }
//   .rpc(name, args) → boolean
//
// Cada test define qué responde la BD vía mockQueryResult / mockRpcResult.

type AnyObj = Record<string, unknown>;

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

/** Cola de resultados encolados por test. Cada llamada a .maybeSingle() / .single()
 *  consume uno. Permite scriptear secuencias precisas: SELECT, SELECT, UPDATE. */
const queryResultQueue: Array<{ data: unknown; error: unknown }> = [];

/** Cola de resultados encolados para operaciones sin select (.update().eq, .insert sin select). */
const mutationResultQueue: Array<{ data: unknown; error: unknown }> = [];

function nextQuery() {
  return queryResultQueue.shift() ?? { data: null, error: null };
}
function nextMutation() {
  return mutationResultQueue.shift() ?? { data: null, error: null };
}

function makeBuilder() {
  const builder: AnyObj = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => nextQuery());
  builder.single = vi.fn(async () => nextQuery());
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  // Cuando se hace .update().eq() sin .select() después, la promesa final resuelve.
  // Lo emulamos con un then() para que await funcione.
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(nextMutation()).then(resolve);
  return builder;
}

const mockFrom = vi.fn(() => makeBuilder());

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/ratelimit", () => ({
  rl: { tournament: null },
  checkLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────────────

import {
  createGroup,
  inviteToGroup,
  acceptInvitation,
  rejectInvitation,
  leaveGroup,
  removeMember,
  promoteCoAdmin,
  demoteCoAdmin,
  transferAdmin,
  updateGroupSettings,
  deactivateGroup,
} from "../groups";

// ── Constants ───────────────────────────────────────────────────────────────

const USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";
const THIRD_USER_ID = "00000000-0000-0000-0000-000000000003";
const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const INVITATION_ID = "22222222-2222-2222-2222-222222222222";

// ── Helpers ─────────────────────────────────────────────────────────────────

function authAs(userId: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
}

function enqueueQuery(data: unknown, error: unknown = null) {
  queryResultQueue.push({ data, error });
}
function enqueueMutation(data: unknown = null, error: unknown = null) {
  mutationResultQueue.push({ data, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryResultQueue.length = 0;
  mutationResultQueue.length = 0;
  mockRpc.mockResolvedValue({ data: false, error: null });
});

// ── createGroup ─────────────────────────────────────────────────────────────

describe("createGroup", () => {
  it("rechaza nombre < 2 chars", async () => {
    authAs(USER_ID);
    const r = await createGroup({ name: "A", allowFriendlies: true });
    expect(r.ok).toBe(false);
  });

  it("rechaza no autenticado", async () => {
    authAs(null);
    const r = await createGroup({ name: "Crew Cárcel", allowFriendlies: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("No autenticado");
  });

  it("crea grupo + auto-añade creator como admin activo", async () => {
    authAs(USER_ID);
    enqueueQuery({ id: GROUP_ID }); // insert groups → select id → single
    enqueueMutation();              // insert group_members (creator) — sin select

    const r = await createGroup({ name: "Los Jueves", description: "Crew de los jueves", allowFriendlies: true });

    expect(r.ok).toBe(true);
    if (r.ok && r.data) expect(r.data.groupId).toBe(GROUP_ID);
    // 2 llamadas: groups + group_members
    expect(mockFrom).toHaveBeenCalledWith("groups");
    expect(mockFrom).toHaveBeenCalledWith("group_members");
  });
});

// ── inviteToGroup ───────────────────────────────────────────────────────────

describe("inviteToGroup", () => {
  it("rechaza invitarse a uno mismo", async () => {
    authAs(USER_ID);
    const r = await inviteToGroup({ groupId: GROUP_ID, userId: USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ti mismo/i);
  });

  it("rechaza si el caller no es admin/co_admin", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: false, error: null }); // is_group_admin → false
    const r = await inviteToGroup({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permisos/i);
  });

  it("rechaza si el invitee ya está activo", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: "x", status: "active" }); // existing member row
    const r = await inviteToGroup({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ya es miembro/i);
  });

  it("rechaza si ya hay invitación pendiente", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: "x", status: "invited" });
    const r = await inviteToGroup({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pendiente/i);
  });

  it("permite re-invitar a alguien que estaba left/removed/rejected", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: "existing-row", status: "left" }); // member row vieja
    enqueueMutation();                                     // UPDATE group_members
    enqueueQuery({ id: INVITATION_ID });                   // INSERT invitations → select.single

    const r = await inviteToGroup({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) expect(r.data.invitationId).toBe(INVITATION_ID);
  });

  it("invita por primera vez (sin fila previa)", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery(null);                  // no existing row
    enqueueMutation();                   // INSERT group_members
    enqueueQuery({ id: INVITATION_ID }); // INSERT invitations
    const r = await inviteToGroup({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
  });
});

// ── acceptInvitation / rejectInvitation ─────────────────────────────────────

describe("acceptInvitation", () => {
  it("rechaza si la invitación no es del user actual", async () => {
    authAs(USER_ID);
    enqueueQuery({
      id: INVITATION_ID,
      group_id: GROUP_ID,
      invited_user_id: OTHER_USER_ID,
      status: "pending",
    });
    const r = await acceptInvitation({ invitationId: INVITATION_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no es para ti/i);
  });

  it("rechaza si la invitación ya no está pending", async () => {
    authAs(USER_ID);
    enqueueQuery({
      id: INVITATION_ID,
      group_id: GROUP_ID,
      invited_user_id: USER_ID,
      status: "accepted",
    });
    const r = await acceptInvitation({ invitationId: INVITATION_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pendiente/i);
  });

  it("transiciona invitations → accepted + members → active", async () => {
    authAs(USER_ID);
    enqueueQuery({
      id: INVITATION_ID,
      group_id: GROUP_ID,
      invited_user_id: USER_ID,
      status: "pending",
    });
    enqueueMutation(); // UPDATE invitations
    enqueueMutation(); // UPDATE members
    const r = await acceptInvitation({ invitationId: INVITATION_ID });
    expect(r.ok).toBe(true);
  });
});

describe("rejectInvitation", () => {
  it("DELETE de group_members al rechazar (decisión #3 hard-delete)", async () => {
    authAs(USER_ID);
    enqueueQuery({
      id: INVITATION_ID,
      group_id: GROUP_ID,
      invited_user_id: USER_ID,
      status: "pending",
    });
    enqueueMutation(); // UPDATE invitations
    enqueueMutation(); // DELETE members
    const r = await rejectInvitation({ invitationId: INVITATION_ID });
    expect(r.ok).toBe(true);
  });
});

// ── leaveGroup ──────────────────────────────────────────────────────────────

describe("leaveGroup", () => {
  it("rechaza si user no es miembro activo", async () => {
    authAs(USER_ID);
    enqueueQuery(null);
    const r = await leaveGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no eres miembro/i);
  });

  it("bloquea si el user es admin del grupo (decisión #11)", async () => {
    authAs(USER_ID);
    enqueueQuery({ id: "x", role: "admin", status: "active" });
    const r = await leaveGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/transfiere/i);
  });

  it("permite salir si es co_admin o member", async () => {
    authAs(USER_ID);
    enqueueQuery({ id: "x", role: "co_admin", status: "active" });
    enqueueMutation();
    const r = await leaveGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
  });
});

// ── removeMember ────────────────────────────────────────────────────────────

describe("removeMember", () => {
  it("rechaza sacarse a uno mismo (debe usar leaveGroup)", async () => {
    authAs(USER_ID);
    const r = await removeMember({ groupId: GROUP_ID, userId: USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/salir del grupo/i);
  });

  it("rechaza si el caller no es admin/co_admin", async () => {
    authAs(USER_ID);
    enqueueQuery({ role: "member", status: "active" });
    const r = await removeMember({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permisos/i);
  });

  it("co_admin NO puede sacar a co_admin (decisión #10 dim 1 = b)", async () => {
    authAs(USER_ID);
    enqueueQuery({ role: "co_admin", status: "active" }); // caller
    enqueueQuery({ id: "x", role: "co_admin", status: "active" }); // target
    const r = await removeMember({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/solo pueden sacar a miembros/i);
  });

  it("admin puede sacar a co_admin", async () => {
    authAs(USER_ID);
    enqueueQuery({ role: "admin", status: "active" });
    enqueueQuery({ id: "x", role: "co_admin", status: "active" });
    enqueueMutation();
    const r = await removeMember({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
  });

  it("no se puede sacar al admin (creator) del grupo", async () => {
    authAs(USER_ID);
    enqueueQuery({ role: "admin", status: "active" });
    enqueueQuery({ id: "x", role: "admin", status: "active" }); // (no debería existir, pero defensivo)
    const r = await removeMember({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/admin del grupo/i);
  });
});

// ── promote / demote ────────────────────────────────────────────────────────

describe("promoteCoAdmin / demoteCoAdmin", () => {
  it("solo el creator puede promover (decisión #10 dim 2 = e)", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: OTHER_USER_ID }); // group: creator es otro
    const r = await promoteCoAdmin({ groupId: GROUP_ID, userId: THIRD_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/solo el admin/i);
  });

  it("promueve member → co_admin si caller es creator", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID });
    enqueueQuery({ id: "x", role: "member", status: "active" });
    enqueueMutation();
    const r = await promoteCoAdmin({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
  });

  it("rechaza promover si el target no es member (es co_admin ya)", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID });
    enqueueQuery({ id: "x", role: "co_admin", status: "active" });
    const r = await promoteCoAdmin({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/member/i);
  });

  it("demote: co_admin → member", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID });
    enqueueQuery({ id: "x", role: "co_admin", status: "active" });
    enqueueMutation();
    const r = await demoteCoAdmin({ groupId: GROUP_ID, userId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
  });
});

// ── transferAdmin ───────────────────────────────────────────────────────────

describe("transferAdmin (RPC atómica, fix #1 review)", () => {
  it("rechaza transferirse a uno mismo (validación TS antes de RPC)", async () => {
    authAs(USER_ID);
    const r = await transferAdmin({ groupId: GROUP_ID, newAdminUserId: USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Ya eres el admin/i);
  });

  it("mapea 'only_creator_can_transfer' a mensaje user-friendly", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: null, error: { message: "only_creator_can_transfer" } });
    const r = await transferAdmin({ groupId: GROUP_ID, newAdminUserId: THIRD_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/solo el admin/i);
  });

  it("mapea 'new_admin_not_active_member' a mensaje user-friendly", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: null, error: { message: "new_admin_not_active_member" } });
    const r = await transferAdmin({ groupId: GROUP_ID, newAdminUserId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/miembro activo/i);
  });

  it("mapea 'group_not_found' a mensaje user-friendly", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: null, error: { message: "group_not_found" } });
    const r = await transferAdmin({ groupId: GROUP_ID, newAdminUserId: OTHER_USER_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no encontrado/i);
  });

  it("éxito cuando RPC devuelve sin error", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: null, error: null });
    const r = await transferAdmin({ groupId: GROUP_ID, newAdminUserId: OTHER_USER_ID });
    expect(r.ok).toBe(true);
    // Llamó a la RPC correcta.
    expect(mockRpc).toHaveBeenCalledWith(
      "transfer_group_admin",
      expect.objectContaining({
        p_group_id: GROUP_ID,
        p_new_admin_id: OTHER_USER_ID,
      }),
    );
  });
});

// ── updateGroupSettings ─────────────────────────────────────────────────────

describe("updateGroupSettings", () => {
  it("solo el creator puede editar (decisión #13 dim 1 = a)", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: OTHER_USER_ID, is_active: true });
    const r = await updateGroupSettings({ groupId: GROUP_ID, name: "Nuevo nombre" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/solo el admin/i);
  });

  it("rechaza si el grupo está desactivado", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID, is_active: false });
    const r = await updateGroupSettings({ groupId: GROUP_ID, name: "Nuevo nombre" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/desactivado/i);
  });

  it("rechaza si no hay cambios", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID, is_active: true });
    const r = await updateGroupSettings({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cambios/i);
  });

  it("actualiza solo los campos provistos", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID, is_active: true });
    enqueueMutation();
    const r = await updateGroupSettings({ groupId: GROUP_ID, allowFriendlies: false });
    expect(r.ok).toBe(true);
  });
});

// ── deactivateGroup ─────────────────────────────────────────────────────────

describe("deactivateGroup", () => {
  it("solo el creator puede desactivar (decisión #13 dim 2 = c)", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: OTHER_USER_ID, is_active: true });
    const r = await deactivateGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/solo el admin/i);
  });

  it("rechaza si ya está desactivado", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID, is_active: false });
    const r = await deactivateGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ya está desactivado/i);
  });

  it("desactiva si el caller es creator", async () => {
    authAs(USER_ID);
    enqueueQuery({ created_by_user_id: USER_ID, is_active: true });
    enqueueMutation();
    const r = await deactivateGroup({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
  });
});
