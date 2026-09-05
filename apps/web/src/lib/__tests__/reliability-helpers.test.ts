/**
 * Unit tests for NR / reliability helpers (src/lib/rating.ts).
 * Sprint Reliability NR — R2.4.
 */

import { describe, it, expect } from "vitest";
import {
  isRated,
  getDisplayRating,
  getReliabilityBucket,
  NR_THRESHOLD,
} from "../rating";

describe("isRated", () => {
  it("prefiere la columna is_rated del DB cuando viene definida", () => {
    expect(isRated({ is_rated: true,  doubles_games: 0 })).toBe(true);
    expect(isRated({ is_rated: false, doubles_games: 999 })).toBe(false);
  });

  it("suma los 2 buckets doubles cuando is_rated no viene en el objeto", () => {
    expect(isRated({ doubles_games: 5 })).toBe(true);
    expect(isRated({ doubles_games: 4 })).toBe(false);
    expect(isRated({ doubles_games: 2, d9_doubles_games: 3 })).toBe(true);
    expect(isRated({ d9_doubles_games: 5 })).toBe(true);
    expect(isRated({ doubles_games: 2, d9_doubles_games: 2 })).toBe(false);
    expect(isRated({ doubles_games: 3, d9_doubles_games: 2 })).toBe(true);
  });

  it("trata nulls y undefined como 0", () => {
    expect(isRated({ doubles_games: null, d9_doubles_games: 5 })).toBe(true);
    expect(isRated({})).toBe(false);
  });

  it("NR_THRESHOLD es 5 (sincronizado con DB)", () => {
    expect(NR_THRESHOLD).toBe(5);
  });

  it("boundary exacto: 4 partidas false, 5 partidas true", () => {
    expect(isRated({ doubles_games: 4 })).toBe(false);
    expect(isRated({ doubles_games: 5 })).toBe(true);
  });
});

describe("getDisplayRating", () => {
  it("retorna null cuando el player es NR (sin importar el elo)", () => {
    expect(getDisplayRating({ is_rated: false, global_elo: 1800 })).toBeNull();
    expect(getDisplayRating({ doubles_games: 4, global_elo: 1800 })).toBeNull();
  });

  it("usa precomputedDisplay si viene, sin tocar global_elo", () => {
    const r = getDisplayRating(
      { is_rated: true, global_elo: 1500 },
      { precomputedDisplay: 12.4 },
    );
    expect(r).toBe(12.4);
  });

  it("usa global_display de la view cuando está disponible", () => {
    expect(getDisplayRating({ is_rated: true, global_display: 8.7 })).toBe(8.7);
  });

  it("deriva de global_elo cuando solo hay elo", () => {
    // Elo 1500 → 1 + ((1500-1000)/1200)*19 = 8.9 (round to 1 decimal)
    const r = getDisplayRating({ is_rated: true, global_elo: 1500 });
    expect(r).toBe(8.9);
  });

  it("retorna null si is_rated pero faltan elo + display", () => {
    expect(getDisplayRating({ is_rated: true })).toBeNull();
  });

  it("precomputedDisplay null fuerza fallback al view", () => {
    const r = getDisplayRating(
      { is_rated: true, global_display: 10 },
      { precomputedDisplay: null },
    );
    expect(r).toBe(10);
  });
});

describe("getReliabilityBucket", () => {
  it("calibrating: 0-29", () => {
    expect(getReliabilityBucket(0).key).toBe("calibrating");
    expect(getReliabilityBucket(29).key).toBe("calibrating");
  });

  it("developing: 30-59", () => {
    expect(getReliabilityBucket(30).key).toBe("developing");
    expect(getReliabilityBucket(59).key).toBe("developing");
  });

  it("reliable: 60-89", () => {
    expect(getReliabilityBucket(60).key).toBe("reliable");
    expect(getReliabilityBucket(89).key).toBe("reliable");
  });

  it("very_reliable: 90-100", () => {
    expect(getReliabilityBucket(90).key).toBe("very_reliable");
    expect(getReliabilityBucket(100).key).toBe("very_reliable");
  });

  it("retorna label + className válidos en cada bucket", () => {
    for (const score of [0, 30, 60, 90]) {
      const b = getReliabilityBucket(score);
      expect(b.label).toBeTruthy();
      expect(b.className).toMatch(/text-/);
      expect(b.className).toMatch(/bg-/);
    }
  });
});
