import { describe, it, expect } from "vitest";
import {
  shouldShowModality,
  buildModalities,
  getVisibleModalities,
} from "../profile";

describe("shouldShowModality", () => {
  it("siempre muestra si isOwnView=true (incluso con 0 partidas)", () => {
    expect(shouldShowModality(0, true)).toBe(true);
    expect(shouldShowModality(5, true)).toBe(true);
  });

  it("oculta modalidades con 0 partidas en vista pública", () => {
    expect(shouldShowModality(0, false)).toBe(false);
  });

  it("muestra modalidades con games > 0 en vista pública", () => {
    expect(shouldShowModality(1, false)).toBe(true);
    expect(shouldShowModality(100, false)).toBe(true);
  });
});

describe("buildModalities", () => {
  it("retorna 2 modalidades en orden d6_d, d9_d (post-Fase-A)", () => {
    const ms = buildModalities({});
    expect(ms.map((m) => m.key)).toEqual([
      "d6_doubles", "d9_doubles",
    ]);
  });

  it("coerce defensive: numeric strings y nulls → 0/defaults", () => {
    const ms = buildModalities({
      d6_doubles_games: "5",
      d9_doubles_games: null,
    });
    expect(ms[0].games).toBe(5);
    expect(ms[1].games).toBe(0);
  });

  it("display y elo usan fallbacks correctos cuando faltan", () => {
    const ms = buildModalities({});
    expect(ms[0].display).toBe(1);
    expect(ms[0].elo).toBe(1500);
  });

  it("cada modalidad expone ctaSet alineado al bucket", () => {
    const ms = buildModalities({});
    expect(ms[0]).toMatchObject({ ctaSet: "d6" });
    expect(ms[1]).toMatchObject({ ctaSet: "d9" });
  });
});

describe("getVisibleModalities", () => {
  const sample = buildModalities({
    d6_doubles_games: 10,
    d9_doubles_games: 0,
  });

  it("isOwnView=true: retorna las 2", () => {
    expect(getVisibleModalities(sample, true)).toHaveLength(2);
  });

  it("isOwnView=false: retorna solo las que tienen games > 0", () => {
    const v = getVisibleModalities(sample, false);
    expect(v).toHaveLength(1);
    expect(v[0].key).toBe("d6_doubles");
  });

  it("usuario sin partidas (sample vacío) + vista pública: vacío", () => {
    const empty = buildModalities({});
    expect(getVisibleModalities(empty, false)).toHaveLength(0);
  });

  it("usuario sin partidas + vista propia: las 2 con emptyCopy", () => {
    const empty = buildModalities({});
    const v = getVisibleModalities(empty, true);
    expect(v).toHaveLength(2);
    v.forEach((m) => expect(m.emptyCopy).toMatch(/Aún no/));
  });
});
