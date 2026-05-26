/**
 * Unit tests for the Elo rating engine (src/lib/rating.ts).
 * Run with: pnpm vitest run src/lib/__tests__/rating.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  kFactorFor,
  updateRatings,
  toDisplayRating,
  displayToElo,
  globalRating,
  winProbability,
  initialRatingFromAssessment,
  DEFAULT_ELO,
  DOMIRANK_MIN_GAMES,
} from "../rating";

// ─── kFactorFor ───────────────────────────────────────────────────────────────

describe("kFactorFor", () => {
  it("returns 40 for a provisional player regardless of elo", () => {
    expect(kFactorFor({ elo: 1500, games_played: 0 })).toBe(40);
  });

  it("returns 40 for a high-elo provisional player (provisional wins over tier)", () => {
    expect(kFactorFor({ elo: 2200, games_played: 5 })).toBe(40);
  });

  it("returns 28 for elo < 1500 with enough games", () => {
    expect(kFactorFor({ elo: 1200, games_played: 50 })).toBe(28);
  });

  it("returns 24 for elo 1500-1899 (stable tier)", () => {
    expect(kFactorFor({ elo: 1700, games_played: 50 })).toBe(24);
  });

  it("returns 18 for elo 1900-2049 (elite tier)", () => {
    expect(kFactorFor({ elo: 1950, games_played: 100 })).toBe(18);
  });

  it("returns 12 for elo >= 2050 (legend tier)", () => {
    expect(kFactorFor({ elo: 2100, games_played: 200 })).toBe(12);
  });

  it("exits provisional at exactly games_played === 10 (elo 1500)", () => {
    // games_played === 10 means >= PROVISIONAL_THRESHOLD, not provisional
    expect(kFactorFor({ elo: 1500, games_played: 10 })).toBe(24);
  });

  it("uses learning k for elo 1499 with games_played 10", () => {
    expect(kFactorFor({ elo: 1499, games_played: 10 })).toBe(28);
  });
});

// ─── updateRatings — 2v2 ─────────────────────────────────────────────────────

describe("updateRatings — 2v2", () => {
  it("equal elo teams: winners gain, losers lose, symmetrically", () => {
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 100,
        players: [
          { user_id: "a1", elo: 1500, games_played: 20 },
          { user_id: "a2", elo: 1500, games_played: 20 },
        ],
      },
      {
        team: 2, rank: 2, score: 80,
        players: [
          { user_id: "b1", elo: 1500, games_played: 20 },
          { user_id: "b2", elo: 1500, games_played: 20 },
        ],
      },
    ]);

    const a1 = result.find((r) => r.user_id === "a1")!;
    const b1 = result.find((r) => r.user_id === "b1")!;

    expect(a1.elo_after).toBeGreaterThan(a1.elo_before);
    expect(b1.elo_after).toBeLessThan(b1.elo_before);

    const gained = a1.elo_after - a1.elo_before;
    const lost   = b1.elo_before - b1.elo_after;
    // Should be in a reasonable range (~12-18 for stable players, equal elo)
    expect(gained).toBeGreaterThan(8);
    expect(gained).toBeLessThan(25);
    // Symmetric (same k, same expected, same movm)
    expect(gained).toBe(lost);
  });

  it("favorite blowout: winners gain LITTLE (MoV autocorrelation correction)", () => {
    // 1800/1800 team blows out 1200/1200 team 100-50 → winners should gain very little
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 100,
        players: [
          { user_id: "fav1", elo: 1800, games_played: 50 },
          { user_id: "fav2", elo: 1800, games_played: 50 },
        ],
      },
      {
        team: 2, rank: 2, score: 50,
        players: [
          { user_id: "und1", elo: 1200, games_played: 50 },
          { user_id: "und2", elo: 1200, games_played: 50 },
        ],
      },
    ]);

    const fav1 = result.find((r) => r.user_id === "fav1")!;
    // Favorite expected to win >> 0.5, so gain is small
    // Expected ~= 1/(1 + 10^((-600)/400)) ~= 0.985
    // With movm and K=24: delta ~= 24 * movm * (1 - 0.985) — should be < 8
    const gained = fav1.elo_after - fav1.elo_before;
    expect(gained).toBeGreaterThanOrEqual(0);
    expect(gained).toBeLessThanOrEqual(8);
  });

  it("underdog upset: underdogs gain A LOT", () => {
    // 1200/1200 upsets 1800/1800 by 100-90 → underdogs should gain ~30-50
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 100,
        players: [
          { user_id: "und1", elo: 1200, games_played: 50 },
          { user_id: "und2", elo: 1200, games_played: 50 },
        ],
      },
      {
        team: 2, rank: 2, score: 90,
        players: [
          { user_id: "fav1", elo: 1800, games_played: 50 },
          { user_id: "fav2", elo: 1800, games_played: 50 },
        ],
      },
    ]);

    const und1 = result.find((r) => r.user_id === "und1")!;
    const fav1 = result.find((r) => r.user_id === "fav1")!;

    const underdogGain  = und1.elo_after - und1.elo_before;
    const favoriteLoss  = fav1.elo_before - fav1.elo_after;

    // Underdogs gain a lot (high (1-expected) for them since expected was ~0.015)
    expect(underdogGain).toBeGreaterThan(20);
    expect(underdogGain).toBeLessThanOrEqual(40);
    expect(favoriteLoss).toBeGreaterThan(10);
  });

  it("provisional player moves ~1.67x more than stable player (K 40 vs 24)", () => {
    // Provisional (games=0) paired with stable (games=20), same elo
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 100,
        players: [
          { user_id: "prov", elo: 1500, games_played: 0 },  // K=40
        ],
      },
      {
        team: 2, rank: 2, score: 80,
        players: [
          { user_id: "stable", elo: 1500, games_played: 20 }, // K=24
        ],
      },
    ]);

    const prov   = result.find((r) => r.user_id === "prov")!;
    const stable = result.find((r) => r.user_id === "stable")!;

    const provGain   = prov.elo_after   - prov.elo_before;
    const stableLoss = stable.elo_before - stable.elo_after;

    // K ratio is 40/24 ≈ 1.67
    const ratio = provGain / stableLoss;
    expect(ratio).toBeCloseTo(40 / 24, 1);
    expect(prov.k_used).toBe(40);
    expect(stable.k_used).toBe(24);
  });

  it("increments games_after by 1 for every player", () => {
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 100,
        players: [{ user_id: "a", elo: 1500, games_played: 7 }],
      },
      {
        team: 2, rank: 2, score: 90,
        players: [{ user_id: "b", elo: 1500, games_played: 15 }],
      },
    ]);

    expect(result.find((r) => r.user_id === "a")!.games_after).toBe(8);
    expect(result.find((r) => r.user_id === "b")!.games_after).toBe(16);
  });
});

// ─── updateRatings — 1v1 ─────────────────────────────────────────────────────

describe("updateRatings — 1v1", () => {
  it("same elo: winner gains, loser loses a reasonable amount", () => {
    const result = updateRatings([
      {
        team: 1, rank: 1, score: 6,
        players: [{ user_id: "alice", elo: 1500, games_played: 20 }],
      },
      {
        team: 2, rank: 2, score: 4,
        players: [{ user_id: "bob", elo: 1500, games_played: 20 }],
      },
    ]);

    const alice = result.find((r) => r.user_id === "alice")!;
    const bob   = result.find((r) => r.user_id === "bob")!;

    expect(alice.elo_after).toBeGreaterThan(alice.elo_before);
    expect(bob.elo_after).toBeLessThan(bob.elo_before);
    // ~6 points for a close game between equal players (K=24, expected=0.5)
    expect(alice.elo_after - alice.elo_before).toBeGreaterThan(3);
    expect(alice.elo_after - alice.elo_before).toBeLessThan(20);
  });

  it("throws for >2 teams", () => {
    expect(() =>
      updateRatings([
        { team: 1, rank: 1, score: 10, players: [{ user_id: "a", elo: 1500, games_played: 0 }] },
        { team: 2, rank: 2, score: 8,  players: [{ user_id: "b", elo: 1500, games_played: 0 }] },
        // @ts-expect-error — testing runtime guard for >2 teams (rank 3 is intentionally invalid).
        { team: 3, rank: 3, score: 6,  players: [{ user_id: "c", elo: 1500, games_played: 0 }] },
      ])
    ).toThrow();
  });
});

// ─── toDisplayRating ─────────────────────────────────────────────────────────

describe("toDisplayRating", () => {
  it("elo 1000 → 1.0 (lower anchor)", () => {
    expect(toDisplayRating(1000)).toBe(1.0);
  });

  it("elo 1500 → approximately 8.9", () => {
    // 1 + ((1500-1000)/1200)*19 = 1 + (500/1200)*19 = 1 + 7.9167 = 8.9167 → 8.9
    expect(toDisplayRating(1500)).toBeCloseTo(8.9, 0);
  });

  it("elo 2200 → 20.0 (upper anchor)", () => {
    // 1 + ((2200-1000)/1200)*19 = 1 + (1200/1200)*19 = 1 + 19 = 20
    expect(toDisplayRating(2200)).toBe(20.0);
  });

  it("elo 800 → 1.0 (clamped at minimum)", () => {
    expect(toDisplayRating(800)).toBe(1.0);
  });

  it("elo 3000 → 20.0 (clamped at maximum)", () => {
    expect(toDisplayRating(3000)).toBe(20.0);
  });

  it("rounds to 1 decimal", () => {
    const result = toDisplayRating(1450);
    expect(result).toBe(Math.round(result * 10) / 10);
  });
});

// ─── globalRating ─────────────────────────────────────────────────────────────

describe("globalRating", () => {
  it("weighted average of two active buckets", () => {
    // d6_singles: elo=1600, games=20; d6_doubles: elo=1700, games=30
    // weighted = (1600*20 + 1700*30) / 50 = (32000 + 51000) / 50 = 83000/50 = 1660
    const result = globalRating({
      d6_singles: { elo: 1600, games_played: 20 },
      d6_doubles: { elo: 1700, games_played: 30 },
      d9_singles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_doubles: { elo: DEFAULT_ELO, games_played: 0 },
    });
    expect(result.elo).toBe(1660);
    expect(result.games_played).toBe(50);
    expect(result.display).not.toBeNull();
  });

  it("no buckets played → display is null", () => {
    const result = globalRating({
      d6_singles: { elo: DEFAULT_ELO, games_played: 0 },
      d6_doubles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_singles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_doubles: { elo: DEFAULT_ELO, games_played: 0 },
    });
    expect(result.display).toBeNull();
    expect(result.games_played).toBe(0);
  });

  it("total games < DOMIRANK_MIN_GAMES → display is null", () => {
    const result = globalRating({
      d6_singles: { elo: 1600, games_played: 3 },
      d6_doubles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_singles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_doubles: { elo: DEFAULT_ELO, games_played: 0 },
    });
    expect(result.games_played).toBe(3);
    expect(result.games_played).toBeLessThan(DOMIRANK_MIN_GAMES);
    expect(result.display).toBeNull();
  });

  it("total games >= DOMIRANK_MIN_GAMES → display is a number", () => {
    const result = globalRating({
      d6_singles: { elo: 1600, games_played: 5 },
      d6_doubles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_singles: { elo: DEFAULT_ELO, games_played: 0 },
      d9_doubles: { elo: DEFAULT_ELO, games_played: 0 },
    });
    expect(result.display).not.toBeNull();
  });
});

// ─── winProbability ───────────────────────────────────────────────────────────

describe("winProbability", () => {
  it("same elo → 0.5 exactly", () => {
    const prob = winProbability(
      [{ user_id: "a", elo: 1500, games_played: 10 }],
      [{ user_id: "b", elo: 1500, games_played: 10 }],
    );
    expect(prob).toBeCloseTo(0.5, 5);
  });

  it("+200 elo advantage → approximately 0.76", () => {
    // 1/(1+10^(-200/400)) = 1/(1+10^(-0.5)) = 1/(1+0.316) ≈ 0.760
    const prob = winProbability(
      [{ user_id: "a", elo: 1700, games_played: 10 }],
      [{ user_id: "b", elo: 1500, games_played: 10 }],
    );
    expect(prob).toBeCloseTo(0.76, 1);
  });

  it("+400 elo advantage → approximately 0.91", () => {
    // 1/(1+10^(-400/400)) = 1/(1+10^(-1)) = 1/(1+0.1) ≈ 0.909
    const prob = winProbability(
      [{ user_id: "a", elo: 1900, games_played: 10 }],
      [{ user_id: "b", elo: 1500, games_played: 10 }],
    );
    expect(prob).toBeCloseTo(0.909, 1);
  });

  it("team average elo is used for 2v2", () => {
    const probSingles = winProbability(
      [{ user_id: "a", elo: 1700, games_played: 10 }],
      [{ user_id: "b", elo: 1500, games_played: 10 }],
    );
    const probDoubles = winProbability(
      [
        { user_id: "a1", elo: 1800, games_played: 10 },
        { user_id: "a2", elo: 1600, games_played: 10 },
      ],
      [
        { user_id: "b1", elo: 1600, games_played: 10 },
        { user_id: "b2", elo: 1400, games_played: 10 },
      ],
    );
    // Both have avg 1700 vs 1500, same result
    expect(probDoubles).toBeCloseTo(probSingles, 5);
  });
});

// ─── initialRatingFromAssessment ──────────────────────────────────────────────

describe("initialRatingFromAssessment", () => {
  it("0 points → elo 1300 (Aprendiz)", () => {
    const result = initialRatingFromAssessment(0);
    expect(result.elo).toBe(1300);
  });

  it("5 points → elo 1450 (Casual)", () => {
    const result = initialRatingFromAssessment(5);
    expect(result.elo).toBe(1450);
  });

  it("12 points → elo 1850 (Maestro)", () => {
    const result = initialRatingFromAssessment(12);
    expect(result.elo).toBe(1850);
  });

  it("estimatedDisplay is consistent with toDisplayRating(elo)", () => {
    for (const points of [0, 3, 6, 9, 12]) {
      const { elo, estimatedDisplay } = initialRatingFromAssessment(points);
      expect(estimatedDisplay).toBe(toDisplayRating(elo));
    }
  });
});

// ─── displayToElo (inverse) ──────────────────────────────────────────────────

describe("displayToElo (inverse of toDisplayRating)", () => {
  it("display 1.0 → elo 1000", () => {
    expect(displayToElo(1.0)).toBeCloseTo(1000, 0);
  });

  it("display 20.0 → elo 2200", () => {
    expect(displayToElo(20.0)).toBeCloseTo(2200, 0);
  });
});

// ─── Defensive guards against non-finite inputs (M4) ─────────────────────────

describe("updateRatings — defensive guards", () => {
  const baseTeam = (elo: number, score: number, team: 1 | 2, rank: 1 | 2) => ({
    team,
    rank,
    score,
    players: [{ user_id: `u${team}`, elo, games_played: 30 }],
  });

  it("rechaza un jugador con elo NaN", () => {
    expect(() =>
      updateRatings([
        { team: 1, rank: 1, score: 50, players: [{ user_id: "a", elo: NaN, games_played: 30 }] },
        baseTeam(1500, 30, 2, 2),
      ]),
    ).toThrow(/Elo inválido/);
  });

  it("rechaza un jugador con elo Infinity", () => {
    expect(() =>
      updateRatings([
        { team: 1, rank: 1, score: 50, players: [{ user_id: "a", elo: Infinity, games_played: 30 }] },
        baseTeam(1500, 30, 2, 2),
      ]),
    ).toThrow(/Elo inválido/);
  });

  it("rechaza un jugador con elo -Infinity", () => {
    expect(() =>
      updateRatings([
        { team: 1, rank: 1, score: 50, players: [{ user_id: "a", elo: -Infinity, games_played: 30 }] },
        baseTeam(1500, 30, 2, 2),
      ]),
    ).toThrow(/Elo inválido/);
  });

  it("rechaza score NaN", () => {
    expect(() =>
      updateRatings([
        { team: 1, rank: 1, score: NaN, players: [{ user_id: "a", elo: 1500, games_played: 30 }] },
        baseTeam(1500, 30, 2, 2),
      ]),
    ).toThrow(/Score inválido/);
  });
});

describe("winProbability — defensive guards", () => {
  it("devuelve 0.5 si algún jugador tiene elo NaN (no propaga NaN)", () => {
    const result = winProbability(
      [{ user_id: "a", elo: NaN, games_played: 0 }],
      [{ user_id: "b", elo: 1500, games_played: 0 }],
    );
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(0.5);
  });

  it("devuelve 0.5 con elo Infinity en cualquier lado", () => {
    expect(
      winProbability(
        [{ user_id: "a", elo: Infinity, games_played: 0 }],
        [{ user_id: "b", elo: 1500, games_played: 0 }],
      ),
    ).toBe(0.5);
    expect(
      winProbability(
        [{ user_id: "a", elo: 1500, games_played: 0 }],
        [{ user_id: "b", elo: -Infinity, games_played: 0 }],
      ),
    ).toBe(0.5);
  });
});
