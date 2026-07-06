/**
 * Unit tests para src/lib/groups-attribution.ts (Fase C+D #3).
 *
 * Cubre importHistoricalMatches: permisos, idempotencia, filtros de
 * amistosas, conteo correcto de matches "fully owned" (donde TODOS los
 * jugadores son miembros activos del grupo).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

const queryResultQueue: Array<{ data: unknown; error: unknown }> = [];

function nextQuery() {
  return queryResultQueue.shift() ?? { data: null, error: null };
}

type AnyObj = Record<string, unknown>;

function makeBuilder() {
  const builder: AnyObj = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.range = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => nextQuery());
  builder.single = vi.fn(async () => nextQuery());
  // .select() sin .maybeSingle ni .single (devuelve array) — la promesa final.
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(nextQuery()).then(resolve);
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import { importHistoricalMatches } from "../groups-attribution";

// ── Constants ───────────────────────────────────────────────────────────────

const USER_ID = "00000000-0000-0000-0000-000000000001";
const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const MATCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MATCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// ── Helpers ─────────────────────────────────────────────────────────────────

function authAs(userId: string | null) {
  mockGetUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
}

function enqueueQuery(data: unknown, error: unknown = null) {
  queryResultQueue.push({ data, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryResultQueue.length = 0;
  mockRpc.mockResolvedValue({ data: 0, error: null });
});

// ── importHistoricalMatches ─────────────────────────────────────────────────

describe("importHistoricalMatches", () => {
  it("rechaza no autenticado", async () => {
    authAs(null);
    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("No autenticado");
  });

  it("rechaza si el caller no es admin/co_admin", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: false, error: null }); // is_group_admin → false
    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permisos/i);
  });

  it("rechaza si el grupo está desactivado", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: GROUP_ID, is_active: false, allow_friendlies: true });
    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/desactivado/i);
  });

  it("rechaza si el grupo tiene < 4 miembros activos", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: true });
    enqueueQuery([{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }]);
    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/4 miembros/i);
  });

  it("devuelve counts=0 cuando no hay matches candidatos", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null });
    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: true });
    enqueueQuery([
      { user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" },
    ]);
    enqueueQuery([]); // match_players de los members
    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data).toEqual({ scanned: 0, imported: 0, skipped: 0 });
    }
  });

  it("solo cuenta matches donde TODOS los jugadores son miembros", async () => {
    authAs(USER_ID);
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // is_group_admin
      .mockResolvedValueOnce({ data: 1, error: null });   // attribute_match_to_groups(MATCH_A) → 1 inserted

    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: true });
    enqueueQuery([
      { user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" },
    ]);

    // candidateMatches: 4 filas para MATCH_A (todos miembros) + 2 para MATCH_B.
    // MATCH_A debería ser fully owned; MATCH_B no (real total > member rows).
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u2", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u3", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u4", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u1", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u2", matches: { status: "confirmed", rated: true } },
    ]);
    // realCounts (ahora con user_id para dedupe): MATCH_A 4 distintos, MATCH_B 4 distintos (2 no-miembros).
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1" }, { match_id: MATCH_A, user_id: "u2" },
      { match_id: MATCH_A, user_id: "u3" }, { match_id: MATCH_A, user_id: "u4" },
      { match_id: MATCH_B, user_id: "u1" }, { match_id: MATCH_B, user_id: "u2" },
      { match_id: MATCH_B, user_id: "x1" }, { match_id: MATCH_B, user_id: "x2" },
    ]);

    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      // Solo MATCH_A pasa el filtro fully-owned (4 jugadores, 4 son miembros).
      expect(r.data.scanned).toBe(1);
      // Y se importó (rpc devolvió 1).
      expect(r.data.imported).toBe(1);
      expect(r.data.skipped).toBe(0);
    }
  });

  it("filtra partidas amistosas si allow_friendlies=false (decisión #4)", async () => {
    authAs(USER_ID);
    mockRpc.mockResolvedValue({ data: true, error: null }); // is_group_admin
    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: false });
    enqueueQuery([
      { user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" },
    ]);
    // MATCH_A es amistosa (rated=false) — debería ser filtrado por allow_friendlies=false.
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u2", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u3", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u4", matches: { status: "confirmed", rated: false } },
    ]);
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1" }, { match_id: MATCH_A, user_id: "u2" },
      { match_id: MATCH_A, user_id: "u3" }, { match_id: MATCH_A, user_id: "u4" },
    ]);

    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      // MATCH_A es amistosa y allow_friendlies=false → filtrado.
      expect(r.data.scanned).toBe(0);
    }
  });

  it("permite amistosas si allow_friendlies=true", async () => {
    authAs(USER_ID);
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 1, error: null });
    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: true });
    enqueueQuery([
      { user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" },
    ]);
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u2", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u3", matches: { status: "confirmed", rated: false } },
      { match_id: MATCH_A, user_id: "u4", matches: { status: "confirmed", rated: false } },
    ]);
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1" }, { match_id: MATCH_A, user_id: "u2" },
      { match_id: MATCH_A, user_id: "u3" }, { match_id: MATCH_A, user_id: "u4" },
    ]);

    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.scanned).toBe(1);
      expect(r.data.imported).toBe(1);
    }
  });

  it("imported/skipped reflejan respuestas de attribute_match_to_groups (idempotencia)", async () => {
    authAs(USER_ID);
    // is_group_admin + 2 calls a attribute_match_to_groups.
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 1, error: null }) // MATCH_A → imported
      .mockResolvedValueOnce({ data: 0, error: null }); // MATCH_B → skipped

    enqueueQuery({ id: GROUP_ID, is_active: true, allow_friendlies: true });
    enqueueQuery([
      { user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" },
    ]);
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u2", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u3", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_A, user_id: "u4", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u1", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u2", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u3", matches: { status: "confirmed", rated: true } },
      { match_id: MATCH_B, user_id: "u4", matches: { status: "confirmed", rated: true } },
    ]);
    enqueueQuery([
      { match_id: MATCH_A, user_id: "u1" }, { match_id: MATCH_A, user_id: "u2" },
      { match_id: MATCH_A, user_id: "u3" }, { match_id: MATCH_A, user_id: "u4" },
      { match_id: MATCH_B, user_id: "u1" }, { match_id: MATCH_B, user_id: "u2" },
      { match_id: MATCH_B, user_id: "u3" }, { match_id: MATCH_B, user_id: "u4" },
    ]);

    const r = await importHistoricalMatches({ groupId: GROUP_ID });
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.scanned).toBe(2);
      expect(r.data.imported).toBe(1);
      expect(r.data.skipped).toBe(1);
    }
  });
});
