import { describe, it, expect } from "vitest";
import { computeStreak } from "../group-streak";

const mkMatch = (finished_at: string, rank: number | null, extras: Partial<{ is_bye: boolean }> = {}) => ({
  finished_at,
  rank,
  ...extras,
});

describe("computeStreak", () => {
  it("returns null si no hay partidas", () => {
    expect(computeStreak([])).toBeNull();
  });

  it("una sola victoria → 1W", () => {
    const r = computeStreak([mkMatch("2026-07-14T10:00:00Z", 1)]);
    expect(r).toEqual({ count: 1, outcome: "W" });
  });

  it("una sola derrota → 1L", () => {
    const r = computeStreak([mkMatch("2026-07-14T10:00:00Z", 2)]);
    expect(r).toEqual({ count: 1, outcome: "L" });
  });

  it("racha larga de 3W", () => {
    const r = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 1),
      mkMatch("2026-07-13T10:00:00Z", 1),
      mkMatch("2026-07-12T10:00:00Z", 1),
    ]);
    expect(r).toEqual({ count: 3, outcome: "W" });
  });

  it("racha se corta con resultado distinto", () => {
    // Más reciente: W, W, L, W → racha = 2W (se corta en la L)
    const r = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 1),
      mkMatch("2026-07-13T10:00:00Z", 1),
      mkMatch("2026-07-12T10:00:00Z", 2),
      mkMatch("2026-07-11T10:00:00Z", 1),
    ]);
    expect(r).toEqual({ count: 2, outcome: "W" });
  });

  it("orden del input no importa (se ordena internamente)", () => {
    const r1 = computeStreak([
      mkMatch("2026-07-12T10:00:00Z", 2),
      mkMatch("2026-07-13T10:00:00Z", 1),
      mkMatch("2026-07-14T10:00:00Z", 1),
    ]);
    const r2 = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 1),
      mkMatch("2026-07-13T10:00:00Z", 1),
      mkMatch("2026-07-12T10:00:00Z", 2),
    ]);
    expect(r1).toEqual({ count: 2, outcome: "W" });
    expect(r2).toEqual({ count: 2, outcome: "W" });
  });

  it("racha inmediata de L después de historia de W", () => {
    // Ganó 10 seguidas y perdió la última → 1L
    const matches = [];
    for (let i = 0; i < 10; i++) {
      matches.push(mkMatch(`2026-07-${String(1 + i).padStart(2, "0")}T10:00:00Z`, 1));
    }
    matches.push(mkMatch("2026-07-15T10:00:00Z", 2)); // Más reciente, es L
    const r = computeStreak(matches);
    expect(r).toEqual({ count: 1, outcome: "L" });
  });

  it("byes se ignoran", () => {
    // Historia: [W bye, W, L] (más reciente primero). El bye se ignora.
    // Sin bye: [W, L] → racha = 1W
    const r = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 1, { is_bye: true }),
      mkMatch("2026-07-13T10:00:00Z", 1),
      mkMatch("2026-07-12T10:00:00Z", 2),
    ]);
    expect(r).toEqual({ count: 1, outcome: "W" });
  });

  it("todos byes → null", () => {
    const r = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 1, { is_bye: true }),
      mkMatch("2026-07-13T10:00:00Z", 1, { is_bye: true }),
    ]);
    expect(r).toBeNull();
  });

  it("rank null se trata como L (no es #1)", () => {
    const r = computeStreak([mkMatch("2026-07-14T10:00:00Z", null)]);
    expect(r).toEqual({ count: 1, outcome: "L" });
  });

  it("rank=3 (perdió en cuadrangular) se trata como L", () => {
    const r = computeStreak([
      mkMatch("2026-07-14T10:00:00Z", 3),
      mkMatch("2026-07-13T10:00:00Z", 3),
    ]);
    expect(r).toEqual({ count: 2, outcome: "L" });
  });

  it("racha muy larga (15 seguidas) sin cap", () => {
    const matches = Array.from({ length: 15 }, (_, i) =>
      mkMatch(`2026-07-${String(1 + i).padStart(2, "0")}T10:00:00Z`, 1),
    );
    const r = computeStreak(matches);
    expect(r).toEqual({ count: 15, outcome: "W" });
  });
});
