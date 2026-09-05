import { describe, expect, it } from "vitest";
import {
  COUNT_RULES,
  COUNTRIES,
  PRESETS,
  PRESET_ORDER,
  countRuleFromLegacyModality,
  matchPreset,
  presetById,
  presetsForCountRule,
} from "../modalidades";

describe("countRuleFromLegacyModality", () => {
  it.each([
    ["ven", "rival"],
    ["dom", "rival"],
    ["cub", "rival"],
    ["custom", "rival"],
    [null, "rival"],
    [undefined, "rival"],
    ["", "rival"],
  ])("mapea %s → %s", (input, expected) => {
    expect(countRuleFromLegacyModality(input as string | null)).toBe(expected);
  });

  it("mapea pri → mesa", () => {
    expect(countRuleFromLegacyModality("pri")).toBe("mesa");
  });
});

describe("presetById", () => {
  it("devuelve el preset por id", () => {
    expect(presetById("rapido")).toEqual(PRESETS.rapido);
    expect(presetById("clasico")).toEqual(PRESETS.clasico);
    expect(presetById("doble9")).toEqual(PRESETS.doble9);
    expect(presetById("mesa-completa")).toEqual(PRESETS["mesa-completa"]);
    expect(presetById("personalizado")).toEqual(PRESETS.personalizado);
  });

  it("devuelve null para id desconocido/vacío", () => {
    expect(presetById("otro")).toBeNull();
    expect(presetById(null)).toBeNull();
    expect(presetById(undefined)).toBeNull();
    expect(presetById("")).toBeNull();
  });
});

describe("presetsForCountRule", () => {
  it("devuelve 2 presets nombrados para rival (Rápido/Clásico) — Doble-9 retirado del menú", () => {
    const ps = presetsForCountRule("rival");
    expect(ps.map((p) => p.id)).toEqual(["rapido", "clasico"]);
  });

  it("devuelve 1 preset nombrado para mesa (Mesa completa)", () => {
    const ps = presetsForCountRule("mesa");
    expect(ps.map((p) => p.id)).toEqual(["mesa-completa"]);
  });

  it("no incluye 'personalizado' ni 'doble9' en el filtrado por regla (creación)", () => {
    for (const rule of ["rival", "mesa"] as const) {
      const ids = presetsForCountRule(rule).map((p) => p.id);
      expect(ids).not.toContain("personalizado");
      expect(ids).not.toContain("doble9");
    }
  });
});

describe("matchPreset — reconstrucción del preset", () => {
  it("reconoce Rápido (rival + d6 + 100 + 30)", () => {
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: 100, capicua_bonus: 30 }),
    ).toEqual(PRESETS.rapido);
  });

  it("reconoce Clásico (rival + d6 + 200 + 30)", () => {
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: 200, capicua_bonus: 30 }),
    ).toEqual(PRESETS.clasico);
  });

  it("reconoce Doble-9 en datos históricos (rival + d9 + 150 + 30) aunque el preset esté retirado del menú", () => {
    expect(
      matchPreset({ count_rule: "rival", set_size: "d9", target_points: 150, capicua_bonus: 30 }),
    ).toEqual(PRESETS.doble9);
  });

  it("reconoce Mesa completa (mesa + d6 + 200 + 50)", () => {
    expect(
      matchPreset({ count_rule: "mesa", set_size: "d6", target_points: 200, capicua_bonus: 50 }),
    ).toEqual(PRESETS["mesa-completa"]);
  });

  it("no reconstruye si un campo difiere (150 pts en rival + d6)", () => {
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: 150, capicua_bonus: 30 }),
    ).toBeNull();
  });

  it("no reconstruye 'personalizado' (queda fuera del reconocimiento nominal)", () => {
    // Personalizado defaults: rival + d6 + 100 + 30 — coincide con Rápido.
    // Un config que NO es ningún preset nombrado debe devolver null.
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: 175, capicua_bonus: 40 }),
    ).toBeNull();
  });

  it("devuelve null si count_rule/set_size/target/capicúa faltan", () => {
    expect(
      matchPreset({ count_rule: null, set_size: "d6", target_points: 100, capicua_bonus: 30 }),
    ).toBeNull();
    expect(
      matchPreset({ count_rule: "rival", set_size: null, target_points: 100, capicua_bonus: 30 }),
    ).toBeNull();
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: null, capicua_bonus: 30 }),
    ).toBeNull();
    expect(
      matchPreset({ count_rule: "rival", set_size: "d6", target_points: 100, capicua_bonus: null }),
    ).toBeNull();
  });
});

describe("COUNT_RULES metadata", () => {
  it("cada regla trae ícono, subtitle y blurb", () => {
    for (const rule of ["rival", "mesa"] as const) {
      const info = COUNT_RULES[rule];
      expect(info.icon).toMatch(/\/modalidades\/cuenta-(rival|mesa)\.svg/);
      expect(info.subtitle.length).toBeGreaterThan(0);
      expect(info.blurb.length).toBeGreaterThan(0);
      expect(info.recommendedCountries.length).toBeGreaterThan(0);
    }
  });
});

describe("COUNTRIES — suggestedPreset por país", () => {
  it.each([
    ["VE", "rapido"],
    ["DO", "clasico"],
    ["CU", "clasico"],
    ["PR", "mesa-completa"],
    ["CO", "rapido"],
    ["AR", "personalizado"],
    ["OT", "personalizado"],
  ])("%s → %s", (code, presetId) => {
    const c = COUNTRIES.find((c) => c.code === code);
    expect(c?.suggestedPreset).toBe(presetId);
  });
});
