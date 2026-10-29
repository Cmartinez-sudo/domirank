/**
 * createNewMatchInContinuousLeague (polla) → RPC create_live_match.
 *
 * Mismo bug que el fast path de torneo: la polla insertaba matches y
 * match_players por separado y, si fallaba el segundo, hacía un DELETE que
 * RLS ignoraba (no hay policy DELETE en matches) → partida in_progress sin
 * jugadores que bloqueaba al creador con "duplicate key ...
 * matches_one_inprogress_per_user". En prod se encontró una así en
 * "Polla del sábado".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockTournamentSingle = vi.fn();
const mockRoster = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "tournaments") {
    return { select: () => ({ eq: () => ({ single: mockTournamentSingle }) }) };
  }
  if (table === "tournament_players") {
    return { select: () => ({ eq: mockRoster }) };
  }
  throw new Error(`from("${table}") no debería usarse al crear la partida`);
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/ratelimit", () => ({
  rl: { matchStart: null },
  checkLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ── Import after mocks ───────────────────────────────────────────────────────

import { createNewMatchInContinuousLeague } from "../continuous-league-actions";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ME = "00000000-0000-4000-8000-000000000001";
const P2 = "00000000-0000-4000-8000-000000000002";
const P3 = "00000000-0000-4000-8000-000000000003";
const P4 = "00000000-0000-4000-8000-000000000004";
const P5 = "00000000-0000-4000-8000-000000000005";
const POLLA = "00000000-0000-4000-8000-0000000000aa";
const NEW_MATCH = "00000000-0000-4000-8000-0000000000bb";
const OTHER_MATCH = "00000000-0000-4000-8000-0000000000cc";

const INPUT = { tournament_id: POLLA, team_a: [ME, P2], team_b: [P3, P4] };

describe("createNewMatchInContinuousLeague → create_live_match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } } });
    mockTournamentSingle.mockResolvedValue({
      data: {
        id: POLLA, format: "continuous_league", status: "in_progress",
        current_season: 3, modality: "ven", points_to_win: 200, rated: true,
      },
      error: null,
    });
    mockRoster.mockResolvedValue({
      data: [ME, P2, P3, P4, P5].map((user_id) => ({ user_id })),
      error: null,
    });
  });

  it("crea match + jugadores + pairing en una sola RPC, sin inserts/deletes directos", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, match_id: NEW_MATCH, reused: false }, error: null });

    const res = await createNewMatchInContinuousLeague(INPUT);

    expect(res).toEqual({ ok: true, match_id: NEW_MATCH });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_live_match",
      expect.objectContaining({
        p_team_a: [ME, P2],
        p_team_b: [P3, P4],
        p_tournament_id: POLLA,
        p_modality: "ven",
        p_target_points: 200,
        p_rated: true,
        p_new_league_pairing: true,
        p_keep_tournament_matches: true,
      }),
    );
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).not.toContain("matches");
    expect(tables).not.toContain("match_players");
    expect(tables).not.toContain("tournament_pairings");
  });

  it("si el creador ya tiene una partida en curso en esta polla, mantiene el mensaje de siempre", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "creator_has_active_match", match_id: OTHER_MATCH, tournament_name: "Polla del sábado", same_tournament: true },
      error: null,
    });

    const res = await createNewMatchInContinuousLeague(INPUT);

    expect(res).toEqual({ ok: false, error: "Ya tienes una partida en curso en esta polla. Continúala primero." });
  });

  it("si la partida en curso es de otro torneo, lo nombra", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "creator_has_active_match", match_id: OTHER_MATCH, tournament_name: "Copa Octubre", same_tournament: false },
      error: null,
    });

    const res = await createNewMatchInContinuousLeague(INPUT);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Copa Octubre");
  });

  it("si otro jugador está en otra partida activa, dice quién", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: false, error: "player_has_active_match", user_id: P3, username: "gusi",
        display_name: null, match_id: OTHER_MATCH, match_status: "pending_attestation", is_self: false,
      },
      error: null,
    });

    const res = await createNewMatchInContinuousLeague(INPUT);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/^@gusi tiene una partida pendiente de confirmación/);
  });

  it("traduce errores de la RPC sin exponer Postgres", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "league_closed" } });

    const res = await createNewMatchInContinuousLeague(INPUT);

    expect(res).toEqual({ ok: false, error: "La polla está cerrada." });
  });

  it("rechaza si el creador no juega, sin llamar a la RPC", async () => {
    const res = await createNewMatchInContinuousLeague({ ...INPUT, team_a: [P5, P2] });

    expect(res).toEqual({ ok: false, error: "Debes ser uno de los 4 jugadores de la partida." });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
