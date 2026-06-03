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
  it("retorna 4 modalidades en orden d6_s, d6_d, d9_s, d9_d", () => {
    const ms = buildModalities({});
    expect(ms.map((m) => m.key)).toEqual([
      "d6_singles", "d6_doubles", "d9_singles", "d9_doubles",
    ]);
  });

  it("coerce defensive: numeric strings y nulls → 0/defaults", () => {
    const ms = buildModalities({
      d6_singles_games: "5",
      d6_doubles_games: null,
      d9_singles_games: undefined,
      d9_doubles_games: 3,
    });
    expect(ms[0].games).toBe(5);
    expect(ms[1].games).toBe(0);
    expect(ms[2].games).toBe(0);
    expect(ms[3].games).toBe(3);
  });

  it("display y elo usan fallbacks correctos cuando faltan", () => {
    const ms = buildModalities({});
    expect(ms[0].display).toBe(1);
    expect(ms[0].elo).toBe(1500);
  });

  it("cada modalidad expone ctaFormat + ctaSet alineado al bucket", () => {
    const ms = buildModalities({});
    expect(ms[0]).toMatchObject({ ctaFormat: "singles", ctaSet: "d6" });
    expect(ms[1]).toMatchObject({ ctaFormat: "doubles", ctaSet: "d6" });
    expect(ms[2]).toMatchObject({ ctaFormat: "singles", ctaSet: "d9" });
    expect(ms[3]).toMatchObject({ ctaFormat: "doubles", ctaSet: "d9" });
  });
});

describe("getVisibleModalities", () => {
  const sample = buildModalities({
    d6_singles_games: 10,
    d6_doubles_games: 0,
    d9_singles_games: 0,
    d9_doubles_games: 0,
  });

  it("isOwnView=true: retorna las 4", () => {
    expect(getVisibleModalities(sample, true)).toHaveLength(4);
  });

  it("isOwnView=false: retorna solo las que tienen games > 0", () => {
    const v = getVisibleModalities(sample, false);
    expect(v).toHaveLength(1);
    expect(v[0].key).toBe("d6_singles");
  });

  it("usuario sin partidas (sample vacío) + vista pública: vacío", () => {
    const empty = buildModalities({});
    expect(getVisibleModalities(empty, false)).toHaveLength(0);
  });

  it("usuario sin partidas + vista propia: las 4 con emptyCopy", () => {
    const empty = buildModalities({});
    const v = getVisibleModalities(empty, true);
    expect(v).toHaveLength(4);
    v.forEach((m) => expect(m.emptyCopy).toMatch(/Aún no/));
  });
});
