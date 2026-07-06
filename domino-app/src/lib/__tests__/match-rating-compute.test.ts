import { describe, it, expect } from "vitest";
import { computeRatingPayload } from "../match-rating-compute";

// Helper: build a profile row with the expected bucket columns.
// Post-Fase-A: solo doubles. El set determina qué bucket de columnas se usa.
function profile(id: string, elo: number, games: number, set: "d6" | "d9" = "d6") {
  const base = set === "d6" ? "doubles" : "d9_doubles";
  return { id, [`${base}_elo`]: elo, [`${base}_games`]: games };
}

describe("computeRatingPayload — guard clauses", () => {
  it("returns no_players when matchPlayers is empty", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [],
      matchRounds: [],
      profiles: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("no_players");
  });

  it("returns missing_profile when a player has no profile row", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [
        { user_id: "a", team: 1 },
        { user_id: "b", team: 1 },
        { user_id: "c", team: 2 },
        { user_id: "d", team: 2 },
      ],
      matchRounds: [
        { team: 1, points: 100 },
        { team: 2, points: 80 },
      ],
      profiles: [profile("a", 1500, 10)],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_profile");
  });
});

describe("computeRatingPayload — doubles 2v2 (d9 bucket selection)", () => {
  it("reads elo/games from d9_doubles when setSize=d9", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d9",
      matchPlayers: [
        { user_id: "a", team: 1 },
        { user_id: "b", team: 1 },
        { user_id: "c", team: 2 },
        { user_id: "d", team: 2 },
      ],
      matchRounds: [
        { team: 1, points: 150 },
        { team: 2, points: 120 },
      ],
      profiles: [
        // d9 columns populated, d6 columns intentionally wrong to assert we
        // read the right bucket. If the code reads `doubles_elo` (d6) por error,
        // el engine ve 9999 y la matemática se rompe.
        { id: "a", d9_doubles_elo: 1500, d9_doubles_games: 10, doubles_elo: 9999, doubles_games: 9999 },
        { id: "b", d9_doubles_elo: 1500, d9_doubles_games: 10, doubles_elo: 9999, doubles_games: 9999 },
        { id: "c", d9_doubles_elo: 1500, d9_doubles_games: 10, doubles_elo: 9999, doubles_games: 9999 },
        { id: "d", d9_doubles_elo: 1500, d9_doubles_games: 10, doubles_elo: 9999, doubles_games: 9999 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.payload.find((p) => p.user_id === "a")!;
    expect(a.elo_before).toBe(1500); // not 9999 (proves bucket selection works)
    expect(a.elo_after).toBeGreaterThan(1500);
  });
});

describe("computeRatingPayload — doubles 2v2", () => {
  it("groups both teammates under their team and assigns the team rank to each", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [
        { user_id: "w1", team: 1 },
        { user_id: "w2", team: 1 },
        { user_id: "l1", team: 2 },
        { user_id: "l2", team: 2 },
      ],
      matchRounds: [
        { team: 1, points: 100 },
        { team: 2, points: 60 },
      ],
      profiles: [
        profile("w1", 1500, 30),
        profile("w2", 1500, 30),
        profile("l1", 1500, 30),
        profile("l2", 1500, 30),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toHaveLength(4);
    const winners = r.payload.filter((p) => p.user_id.startsWith("w"));
    const losers  = r.payload.filter((p) => p.user_id.startsWith("l"));
    expect(winners.every((p) => p.rank === 1)).toBe(true);
    expect(losers.every((p) => p.rank === 2)).toBe(true);
    expect(winners.every((p) => p.elo_after > p.elo_before)).toBe(true);
    expect(losers.every((p) => p.elo_after < p.elo_before)).toBe(true);
  });

  it("rank is 1 for both teams when scores tie", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [
        { user_id: "a", team: 1 },
        { user_id: "b", team: 1 },
        { user_id: "c", team: 2 },
        { user_id: "d", team: 2 },
      ],
      matchRounds: [
        { team: 1, points: 100 },
        { team: 2, points: 100 },
      ],
      profiles: [
        profile("a", 1500, 20),
        profile("b", 1500, 20),
        profile("c", 1500, 20),
        profile("d", 1500, 20),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // rank = 1 + count(teams with strictly higher score). Tied → both rank 1.
    for (const item of r.payload) {
      expect(item.rank).toBe(1);
    }
  });
});

describe("computeRatingPayload — payload shape contract", () => {
  it("emits exactly one payload item per match_players row", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [
        { user_id: "a", team: 1 },
        { user_id: "b", team: 1 },
        { user_id: "c", team: 2 },
        { user_id: "d", team: 2 },
      ],
      matchRounds: [
        { team: 1, points: 100 },
        { team: 2, points: 50 },
      ],
      profiles: [
        profile("a", 1500, 5),
        profile("b", 1500, 5),
        profile("c", 1500, 5),
        profile("d", 1500, 5),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toHaveLength(4);
    for (const item of r.payload) {
      expect(item).toHaveProperty("user_id");
      expect(item).toHaveProperty("rank");
      expect(item).toHaveProperty("elo_before");
      expect(item).toHaveProperty("elo_after");
      expect(item).toHaveProperty("k_used");
      expect(typeof item.k_used).toBe("number");
      expect(item.k_used).toBeGreaterThan(0);
    }
  });

  it("treats missing rounds as zeros (does not crash, ranks by zeros)", () => {
    const r = computeRatingPayload({
      format: "doubles",
      setSize: "d6",
      matchPlayers: [
        { user_id: "a", team: 1 },
        { user_id: "b", team: 1 },
        { user_id: "c", team: 2 },
        { user_id: "d", team: 2 },
      ],
      matchRounds: [], // no rounds recorded
      profiles: [
        profile("a", 1500, 5),
        profile("b", 1500, 5),
        profile("c", 1500, 5),
        profile("d", 1500, 5),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 0 vs 0 → tie → both rank 1.
    for (const item of r.payload) expect(item.rank).toBe(1);
  });
});
