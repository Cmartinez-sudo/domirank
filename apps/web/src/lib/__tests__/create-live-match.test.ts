/**
 * Regresión: "duplicate key value violates unique constraint
 * matches_one_inprogress_per_user" al entrar a la primera partida de un
 * torneo desde el fast path.
 *
 * Causa: startLiveMatch creaba la partida en pasos separados. Si el INSERT de
 * match_players fallaba (trigger trg_one_active_match), el DELETE de rollback
 * lo ignoraba RLS (no hay policy DELETE en matches) → partida in_progress sin
 * jugadores. Después, rpc('cancel_match') sobre esa huérfana fallaba con
 * 'Only participants can cancel a match' sin revisar el error y el INSERT
 * chocaba con el índice único.
 *
 * Esta suite verifica:
 *   1. El contrato SQL de la RPC create_live_match (mig 0113).
 *   2. Que startLiveMatch delega en la RPC (sin insert/delete directos ni
 *      cancel_match ignorado) y traduce errores/conflictos a español.
 *
 * Igual que cancel-elo-integrity.test.ts, no ejecuta SQL: vitest puro NO
 * debe tocar una DB real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockTournamentSingle = vi.fn();
const mockFrom = vi.fn((_table: string) => ({
  select: () => ({ eq: () => ({ single: mockTournamentSingle }) }),
}));

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

vi.mock("@/lib/activation", () => ({
  checkAndFireFirstValuableAction: vi.fn(async () => undefined),
}));
vi.mock("@/lib/match-notifications", () => ({
  buildMatchEmailMeta: vi.fn(),
  sendToUserIds: vi.fn(),
}));
vi.mock("@/lib/email-templates", () => ({ matchAttestRequestedEmail: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ── Import after mocks ───────────────────────────────────────────────────────

import { startLiveMatch } from "../live-match";
import { describeCreateLiveMatchError, conflictMessage } from "../live-match-errors";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ME = "00000000-0000-4000-8000-000000000001";
const P2 = "00000000-0000-4000-8000-000000000002";
const P3 = "00000000-0000-4000-8000-000000000003";
const P4 = "00000000-0000-4000-8000-000000000004";
const TOURNAMENT = "00000000-0000-4000-8000-0000000000aa";
const NEW_MATCH = "00000000-0000-4000-8000-0000000000bb";
const OTHER_MATCH = "00000000-0000-4000-8000-0000000000cc";

const BASE_INPUT = {
  count_rule: "rival" as const,
  format: "doubles" as const,
  set_size: "d6" as const,
  target_points: 200,
  capicua_bonus: 30,
  team_a_players: [ME, P2],
  team_b_players: [P3, P4],
};

const MIG = path.resolve(__dirname, "../../../supabase/migrations/0113_create_live_match_rpc.sql");

function rpcBody(sql: string): string {
  const start = sql.indexOf("function public.create_live_match");
  const bodyStart = sql.indexOf("$$", start);
  const bodyEnd = sql.indexOf("$$", bodyStart + 2);
  return sql.substring(bodyStart, bodyEnd);
}

// ── 1. Contrato SQL ──────────────────────────────────────────────────────────

describe("create_live_match RPC (mig 0113) — contrato SQL", () => {
  const sql = fs.readFileSync(MIG, "utf8");
  const body = rpcBody(sql);

  it("es SECURITY DEFINER con search_path fijo", () => {
    expect(sql).toMatch(/function public\.create_live_match[\s\S]*?security definer\s+set search_path = public/i);
  });

  it("valida auth.uid() y exige que el creador sea jugador", () => {
    expect(body).toMatch(/v_caller\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(body).toMatch(/if v_caller is null then\s+raise exception 'not_authenticated'/i);
    expect(body).toMatch(/not \(v_caller = any\(v_players\)\)[\s\S]*?'creator_not_player'/i);
  });

  it("cancela las in_progress previas del creador con reason replaced_by_new_match (sin cancel_match)", () => {
    expect(body).toMatch(/where created_by = v_caller and status = 'in_progress'/i);
    expect(body).toMatch(/cancellation_reason\s*=\s*'replaced_by_new_match'/i);
    expect(body).toMatch(/insert into public\.match_cancellation_events[\s\S]*?'replaced_by_new_match'/i);
    // cancel_match fuerza user_cancelled + participant check con JWT: no sirve aquí.
    expect(body).not.toMatch(/cancel_match\(/i);
  });

  it("inserta matches y match_players en la misma función, sin DELETE de rollback", () => {
    const matchesInsert = body.search(/insert into public\.matches\s*\(/i);
    const playersInsert = body.search(/insert into public\.match_players/i);
    expect(matchesInsert).toBeGreaterThan(-1);
    expect(playersInsert).toBeGreaterThan(matchesInsert);
    expect(body).not.toMatch(/delete from public\.matches/i);
  });

  it("detecta jugadores con otra partida activa antes de crear y devuelve quién", () => {
    const check = body.search(/'player_has_active_match'/);
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.search(/insert into public\.matches\s*\(/i));
    expect(body).toMatch(/from public\.active_matches_per_user/i);
    expect(body).toMatch(/'display_name'/);
    expect(body).toMatch(/'match_id'/);
  });

  it("es idempotente por pairing (FOR UPDATE + reutiliza la partida in_progress) y lo vincula", () => {
    expect(body).toMatch(/from public\.tournament_pairings\s+where id = p_pairing_id\s+for update/i);
    expect(body).toMatch(/'reused', true/);
    expect(body).toMatch(/update public\.tournament_pairings set match_id = v_match_id/i);
  });

  it("serializa creaciones concurrentes del mismo usuario", () => {
    expect(body).toMatch(/pg_advisory_xact_lock\(/i);
  });

  it("solo authenticated puede ejecutarla", () => {
    expect(sql).toMatch(/revoke all on function public\.create_live_match\([^)]*\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.create_live_match\([^)]*\) to authenticated/i);
  });

  it("limpia huérfanas in_progress sin match_players con reason migration_cleanup", () => {
    const cleanup = sql.substring(sql.indexOf("Limpieza"));
    expect(cleanup).toMatch(/status = 'in_progress'\s+and not exists \(select 1 from public\.match_players/i);
    expect(cleanup).toMatch(/cancellation_reason\s*=\s*'migration_cleanup'/i);
  });

  it("no toca rating ni el flujo de confirmación", () => {
    expect(sql).not.toMatch(/apply_match_rating|mu_after|sigma_after|match_attestations/i);
    expect(sql).not.toMatch(/status\s*=\s*'(confirmed|pending_attestation)'/i);
  });
});

// ── 2. startLiveMatch (server action) ────────────────────────────────────────

describe("startLiveMatch → create_live_match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } } });
    mockTournamentSingle.mockResolvedValue({ data: { rated: false }, error: null });
  });

  it("crea la partida vía RPC atómica, sin insert/delete directos ni cancel_match", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, match_id: NEW_MATCH, reused: false }, error: null });

    const res = await startLiveMatch({ ...BASE_INPUT, tournament_id: TOURNAMENT, pairing_id: 42 });

    expect(res).toEqual({ ok: true, match_id: NEW_MATCH });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_live_match",
      expect.objectContaining({
        p_team_a: [ME, P2],
        p_team_b: [P3, P4],
        p_tournament_id: TOURNAMENT,
        p_pairing_id: 42,
        p_rated: false, // heredado de tournaments.rated
        p_modality: "custom",
      }),
    );
    expect(mockRpc).not.toHaveBeenCalledWith("cancel_match", expect.anything());
    expect(mockFrom.mock.calls.map((c) => c[0])).not.toContain("matches");
    expect(mockFrom.mock.calls.map((c) => c[0])).not.toContain("match_players");
  });

  it("si un jugador ya tiene otra partida activa, dice quién y devuelve el match para enlazar", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: false,
        error: "player_has_active_match",
        user_id: P3,
        username: "gusi",
        display_name: "Gusi",
        match_id: OTHER_MATCH,
        match_status: "in_progress",
        is_self: false,
      },
      error: null,
    });

    const res = await startLiveMatch({ ...BASE_INPUT, tournament_id: TOURNAMENT, pairing_id: 42 });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("Gusi");
    expect(res.error).not.toMatch(/duplicate key|violates|constraint/i);
    expect(res.conflict).toMatchObject({ user_id: P3, match_id: OTHER_MATCH, is_self: false });
  });

  it("no expone el error crudo de Postgres", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: `User ${P2} already has an active match (${OTHER_MATCH}). Finish or cancel it before joining a new one.` },
    });

    const res = await startLiveMatch(BASE_INPUT);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).not.toContain(P2);
    expect(res.error).toMatch(/otra partida activa/);
  });

  it("rechaza si el creador no es uno de los 4 jugadores, sin llamar a la RPC", async () => {
    const res = await startLiveMatch({ ...BASE_INPUT, team_a_players: [P2, "00000000-0000-4000-8000-000000000005"] });

    expect(res).toEqual({ ok: false, error: "Debes ser uno de los 4 jugadores de la partida." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("partida reutilizada (doble render del fast path) devuelve el mismo match_id", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, match_id: NEW_MATCH, reused: true }, error: null });

    const res = await startLiveMatch({ ...BASE_INPUT, tournament_id: TOURNAMENT, pairing_id: 42 });

    expect(res).toEqual({ ok: true, match_id: NEW_MATCH });
  });
});

// ── 3. Mensajes ──────────────────────────────────────────────────────────────

describe("live-match-errors", () => {
  it("traduce los códigos de la RPC a español", () => {
    expect(describeCreateLiveMatchError({ message: "creator_not_player" })).toBe(
      "Debes ser uno de los 4 jugadores de la partida.",
    );
    expect(describeCreateLiveMatchError({ message: "pairing_already_has_match" })).toBe(
      "Esta partida ya fue registrada.",
    );
    expect(
      describeCreateLiveMatchError({
        message: 'duplicate key value violates unique constraint "matches_one_inprogress_per_user"',
      }),
    ).toBe("Ya tienes una partida en curso. Termínala o cancélala antes de empezar otra.");
    expect(describeCreateLiveMatchError({ message: "algo raro" })).toBe(
      "No se pudo crear la partida. Intenta de nuevo.",
    );
  });

  it("distingue conflicto propio vs de otro jugador y pendiente de confirmación", () => {
    const base = { user_id: P2, name: "Erik", match_id: OTHER_MATCH, is_self: false };
    expect(conflictMessage({ ...base, match_status: "in_progress" })).toMatch(/^Erik ya está jugando/);
    expect(conflictMessage({ ...base, match_status: "pending_attestation" })).toMatch(/^Erik tiene una partida pendiente/);
    expect(conflictMessage({ ...base, is_self: true, match_status: "in_progress" })).toMatch(/^Ya estás jugando/);
  });
});
