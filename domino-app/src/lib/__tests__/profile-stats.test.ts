import { describe, it, expect } from "vitest";
import {
  computeStreaks,
  aggregateEloSeries,
  computePartnerRivalStats,
  computeHeadToHead,
} from "../profile-stats";

const mkRow = (rank: number, elo_before: number, elo_after: number, created_at: string, team = 1) => ({
  rank,
  team,
  elo_before,
  elo_after,
  created_at,
  matches: { status: "confirmed" as const, match_players: [] as any[] },
});

describe("computeStreaks", () => {
  it("returns zero streaks for empty history", () => {
    expect(computeStreaks([])).toEqual({ current: { kind: "none", count: 0 }, best: 0 });
  });

  it("computes current W streak", () => {
    const rows = [
      mkRow(1, 1500, 1520, "2026-09-01"),
      mkRow(1, 1480, 1500, "2026-08-31"),
      mkRow(2, 1500, 1480, "2026-08-30"),
    ];
    const r = computeStreaks(rows);
    expect(r.current).toEqual({ kind: "wins", count: 2 });
  });

  it("computes current L streak", () => {
    const rows = [
      mkRow(2, 1520, 1500, "2026-09-01"),
      mkRow(2, 1540, 1520, "2026-08-31"),
      mkRow(1, 1520, 1540, "2026-08-30"),
    ];
    expect(computeStreaks(rows).current).toEqual({ kind: "losses", count: 2 });
  });

  it("computes best win streak historically", () => {
    const rows = [
      mkRow(2, 1500, 1490, "2026-09-01"),
      mkRow(1, 1470, 1500, "2026-08-31"),
      mkRow(1, 1450, 1470, "2026-08-30"),
      mkRow(1, 1430, 1450, "2026-08-29"),
      mkRow(2, 1450, 1430, "2026-08-28"),
    ];
    expect(computeStreaks(rows).best).toBe(3);
  });

  it("ignores non-confirmed matches", () => {
    const rows = [
      { ...mkRow(1, 1500, 1520, "2026-09-01"), matches: { status: "pending_attestation" as const, match_players: [] } },
      mkRow(2, 1520, 1500, "2026-08-31"),
    ];
    expect(computeStreaks(rows).current.kind).toBe("losses");
  });
});

describe("aggregateEloSeries", () => {
  it("returns points unchanged when count <= 100", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      elo_after: 1500 + i,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }));
    const s = aggregateEloSeries(rows, "all");
    expect(s.length).toBe(50);
  });

  it("aggregates by day when count > 100 and range=all", () => {
    const day1 = "2026-01-01T10:00:00Z";
    const day1b = "2026-01-01T20:00:00Z";
    const day2 = "2026-01-02T10:00:00Z";
    const rows = [
      { elo_after: 1500, created_at: day1 },
      { elo_after: 1510, created_at: day1b },
      { elo_after: 1520, created_at: day2 },
      ...Array.from({ length: 120 }, (_, i) => ({
        elo_after: 1500 + i,
        created_at: new Date(2026, 5, i + 1).toISOString(),
      })),
    ];
    const s = aggregateEloSeries(rows, "all");
    const uniqueDays = new Set(s.map((p) => p.day));
    expect(s.length).toBe(uniqueDays.size);
    const jan1 = s.find((p) => p.day === "2026-01-01");
    expect(jan1?.elo).toBe(1510);
  });

  it("slices last N for range=10 / range=50", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      elo_after: 1500 + i,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }));
    expect(aggregateEloSeries(rows, "last10").length).toBe(10);
    expect(aggregateEloSeries(rows, "last50").length).toBe(50);
  });
});

describe("computePartnerRivalStats", () => {
  const partnerRow = (partnerId: string, myWon: boolean) => ({
    rank: myWon ? 1 : 2,
    team: 1,
    matches: {
      status: "confirmed" as const,
      match_players: [
        { team: 1, user_id: "me", score: 0, profiles: null },
        { team: 1, user_id: partnerId, score: 0, profiles: { username: partnerId, display_name: partnerId } },
        { team: 2, user_id: "rival", score: 0, profiles: { username: "rival", display_name: "Rival" } },
      ],
    },
  });

  it("requires min 2 games for partner", () => {
    const rows = [partnerRow("bob", true)];
    const { favoritePartner } = computePartnerRivalStats(rows, "me");
    expect(favoritePartner).toBeNull();
  });

  it("picks partner with most games", () => {
    const rows = [
      partnerRow("bob", true),
      partnerRow("bob", true),
      partnerRow("alice", false),
      partnerRow("alice", true),
    ];
    const { favoritePartner } = computePartnerRivalStats(rows, "me");
    expect(favoritePartner?.name).toBe("bob");
    expect(favoritePartner?.games).toBe(2);
    expect(favoritePartner?.wins).toBe(2);
  });
});

describe("computeHeadToHead", () => {
  const h2hRow = (myTeam: 1 | 2, theirTeam: 1 | 2, myWon: boolean, meScore: number, themScore: number) => ({
    rank: myWon ? 1 : 2,
    team: myTeam,
    matches: {
      status: "confirmed" as const,
      match_players: [
        { team: myTeam, user_id: "me", score: meScore, profiles: null },
        { team: theirTeam, user_id: "them", score: themScore, profiles: { username: "them", display_name: "Them" } },
      ],
    },
  });

  it("counts opposing-team matches as vs", () => {
    const rows = [
      h2hRow(1, 2, true, 200, 100),
      h2hRow(1, 2, false, 100, 200),
      h2hRow(2, 1, true, 200, 100),
    ];
    const r = computeHeadToHead(rows, "me", "them");
    expect(r.vs.games).toBe(3);
    expect(r.vs.my_wins).toBe(2);
    expect(r.vs.their_wins).toBe(1);
  });

  it("counts same-team matches as together", () => {
    const rows = [
      h2hRow(1, 1, true, 200, 200),
      h2hRow(2, 2, false, 100, 100),
    ];
    const r = computeHeadToHead(rows, "me", "them");
    expect(r.together.games).toBe(2);
    expect(r.together.wins).toBe(1);
    expect(r.together.losses).toBe(1);
  });
});
