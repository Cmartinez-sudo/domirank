import { describe, it, expect } from "vitest";
import {
  countPairInteractions,
  countPlayerStats,
  generateFixture,
  generateMultiRoundFixture,
  isSupportedPlayerCount,
  SUPPORTED_PLAYER_COUNTS,
} from "../round-robin-fixture";

describe("round-robin-fixture", () => {
  // ─── API basics ─────────────────────────────────────────────────────

  it("SUPPORTED_PLAYER_COUNTS es [4,5]", () => {
    expect([...SUPPORTED_PLAYER_COUNTS]).toEqual([4, 5]);
  });

  it("isSupportedPlayerCount valida correctamente", () => {
    expect(isSupportedPlayerCount(4)).toBe(true);
    expect(isSupportedPlayerCount(5)).toBe(true);
    expect(isSupportedPlayerCount(6)).toBe(false);
    expect(isSupportedPlayerCount(8)).toBe(false); // reservado para follow-up
    expect(isSupportedPlayerCount(9)).toBe(false); // reservado para follow-up
    expect(isSupportedPlayerCount(0)).toBe(false);
  });

  it("generateFixture rechaza N no soportado", () => {
    expect(() => generateFixture(3)).toThrow(/solo soporta/);
    expect(() => generateFixture(6)).toThrow(/solo soporta/);
    expect(() => generateFixture(8)).toThrow(/solo soporta/);
    expect(() => generateFixture(9)).toThrow(/solo soporta/);
  });

  it("generateFixture retorna el fixture correcto para cada N", () => {
    expect(generateFixture(4).matches).toHaveLength(3);
    expect(generateFixture(5).matches).toHaveLength(5);
  });

  it("generateMultiRoundFixture repite el ciclo R veces con matchNumbers consecutivos", () => {
    const fx = generateMultiRoundFixture(5, 2);
    expect(fx).toHaveLength(10);
    expect(fx[0]!.matchNumber).toBe(1);
    expect(fx[4]!.matchNumber).toBe(5);
    expect(fx[5]!.matchNumber).toBe(6);
    expect(fx[9]!.matchNumber).toBe(10);
    // El fixture repite el mismo esquema
    expect(fx[0]!.home).toEqual(fx[5]!.home);
    expect(fx[0]!.away).toEqual(fx[5]!.away);
  });

  it("generateMultiRoundFixture rechaza rounds < 1", () => {
    expect(() => generateMultiRoundFixture(5, 0)).toThrow(/rounds/);
    expect(() => generateMultiRoundFixture(5, -1)).toThrow(/rounds/);
  });

  // ─── Reglas matemáticas por N ──────────────────────────────────────

  describe("N=4: cada pair pareja 1×, rival 2×, 0 descansos", () => {
    const { matches } = generateFixture(4);
    it("cada player juega en las 3 partidas (0 descansos)", () => {
      const { played, rested } = countPlayerStats(matches, 4);
      for (let i = 0; i < 4; i++) {
        expect(played[i]).toBe(3);
        expect(rested[i]).toBe(0);
      }
    });
    it("cada pair como pareja exactamente 1×", () => {
      const { asPartner } = countPairInteractions(matches, 4);
      for (const count of asPartner.values()) expect(count).toBe(1);
    });
    it("cada pair como rival exactamente 2×", () => {
      const { asRival } = countPairInteractions(matches, 4);
      for (const count of asRival.values()) expect(count).toBe(2);
    });
  });

  describe("N=5: cada pair pareja 1×, rival 2×, 1 descanso por player", () => {
    const { matches } = generateFixture(5);
    it("cada player juega 4 partidas y descansa 1", () => {
      const { played, rested } = countPlayerStats(matches, 5);
      for (let i = 0; i < 5; i++) {
        expect(played[i]).toBe(4);
        expect(rested[i]).toBe(1);
      }
    });
    it("cada pair como pareja exactamente 1×", () => {
      const { asPartner } = countPairInteractions(matches, 5);
      for (const count of asPartner.values()) expect(count).toBe(1);
    });
    it("cada pair como rival exactamente 2×", () => {
      const { asRival } = countPairInteractions(matches, 5);
      for (const count of asRival.values()) expect(count).toBe(2);
    });
    it("matches del fixture matchean el spec del user (letras A-E → índices 0-4)", () => {
      // P1: rest A · BC vs DE
      expect(matches[0]).toMatchObject({ home: [1, 2], away: [3, 4], resting: [0] });
      // P5: rest E · AC vs BD
      expect(matches[4]).toMatchObject({ home: [0, 2], away: [1, 3], resting: [4] });
    });
  });

  // N=8 y N=9 quedan pendientes hasta implementar el Whist tournament
  // design (Bose-Nair). Ver TODO en round-robin-fixture.ts.

  // ─── Sanity checks generales ──────────────────────────────────────

  it("todos los índices están en rango [0, N-1]", () => {
    for (const n of SUPPORTED_PLAYER_COUNTS) {
      const { matches } = generateFixture(n);
      for (const m of matches) {
        for (const idx of [...m.home, ...m.away, ...m.resting]) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(n);
        }
      }
    }
  });

  it("home y away no comparten jugadores, ni tampoco con resting", () => {
    for (const n of SUPPORTED_PLAYER_COUNTS) {
      const { matches } = generateFixture(n);
      for (const m of matches) {
        const home = new Set(m.home);
        const away = new Set(m.away);
        const rest = new Set(m.resting);
        // Sin duplicados dentro de un mismo team
        expect(home.size).toBe(2);
        expect(away.size).toBe(2);
        expect(rest.size).toBe(m.resting.length);
        // Sin overlaps entre teams / rest
        for (const p of home) expect(away.has(p)).toBe(false);
        for (const p of home) expect(rest.has(p)).toBe(false);
        for (const p of away) expect(rest.has(p)).toBe(false);
        // Todos los N players deben estar en algún slot
        expect(home.size + away.size + rest.size).toBe(n);
      }
    }
  });
});
