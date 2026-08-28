/**
 * Modalidades y regla de conteo.
 *
 * Modelo actual (Fase 2 del refactor):
 *   - CountRule ('rival' | 'mesa') es la identidad de "cómo se cuenta al cerrar mano".
 *   - PRESETS combinan CountRule + set + target + capicúa como atajo de UI.
 *   - Los 4 campos (count_rule, set_size, target_points, capicua_bonus)
 *     son la fuente de verdad; los presets no se persisten.
 *
 * Legacy (deprecated):
 *   - MODALIDADES / ModalityCode / modalityByCode se conservan para lectura
 *     de datos históricos (matches.modality etc.) pero no deben usarse en
 *     código nuevo. Preferir COUNT_RULES + PRESETS.
 *
 * Rating: los buckets siguen siendo por SET (d6_doubles / d9_doubles) —
 * count_rule NO afecta el rating.
 */

export type SetCode = "d6" | "d9";

/** @deprecated Usar `CountRule` + `PresetId`. Se conserva para leer datos históricos. */
export type ModalityCode = "ven" | "dom" | "cub" | "pri" | "custom";

export type CountryCode =
  | "VE" | "DO" | "CU" | "PR" | "CO" | "MX" | "PA"
  | "ES" | "US" | "AR" | "CL" | "PE" | "OT";

export type FormatCode = "doubles";

export type SetInfo = {
  code: SetCode;
  label: string;
  tilesPerPlayer: number;
  totalTiles: number;
};

export const SETS: Record<SetCode, SetInfo> = {
  d6: { code: "d6", label: "6-6", tilesPerPlayer: 7, totalTiles: 28 },
  d9: { code: "d9", label: "9-9", tilesPerPlayer: 10, totalTiles: 55 },
};

// ────────────────────────────────────────────────────────────────
// CountRule — nueva identidad de la modalidad
// ────────────────────────────────────────────────────────────────

export type CountRule = "rival" | "mesa";

export type CountRuleInfo = {
  code: CountRule;
  name: string;
  icon: string;
  subtitle: string;
  blurb: string;
  recommendedCountries: CountryCode[];
};

export const COUNT_RULES: Record<CountRule, CountRuleInfo> = {
  rival: {
    code: "rival",
    name: "Cuenta rival",
    icon: "/modalidades/cuenta-rival.svg",
    subtitle: "Se juega así en Venezuela, Rep. Dominicana y Cuba",
    blurb: "Al cerrar la mano, sumas solo las fichas de tus contrincantes.",
    recommendedCountries: ["VE", "DO", "CU"],
  },
  mesa: {
    code: "mesa",
    name: "Cuenta de mesa",
    icon: "/modalidades/cuenta-mesa.svg",
    subtitle: "Se juega así en Puerto Rico",
    blurb: "Al cerrar la mano, sumas todas las fichas que quedaron en la mesa.",
    recommendedCountries: ["PR"],
  },
};

// ────────────────────────────────────────────────────────────────
// Presets — atajos de UI (NO se persisten)
// ────────────────────────────────────────────────────────────────

export type PresetId =
  | "rapido"
  | "clasico"
  | "doble9"
  | "mesa-completa"
  | "personalizado";

export type Preset = {
  id: PresetId;
  title: string;
  countRule: CountRule;
  set: SetCode;
  target: number;
  capicua: number;
  noteCountry: string | null;
};

export const PRESETS: Record<PresetId, Preset> = {
  rapido: {
    id: "rapido",
    title: "Rápido",
    countRule: "rival",
    set: "d6",
    target: 100,
    capicua: 30,
    noteCountry: "Común en Venezuela",
  },
  clasico: {
    id: "clasico",
    title: "Clásico",
    countRule: "rival",
    set: "d6",
    target: 200,
    capicua: 30,
    noteCountry: "Común en Rep. Dominicana",
  },
  doble9: {
    id: "doble9",
    title: "Doble-9",
    countRule: "rival",
    set: "d9",
    target: 150,
    capicua: 30,
    noteCountry: "Común en Cuba",
  },
  "mesa-completa": {
    id: "mesa-completa",
    title: "Mesa completa",
    countRule: "mesa",
    set: "d6",
    target: 200,
    capicua: 50,
    noteCountry: "Común en Puerto Rico",
  },
  personalizado: {
    id: "personalizado",
    title: "Personalizado",
    countRule: "rival",
    set: "d6",
    target: 100,
    capicua: 30,
    noteCountry: null,
  },
};

export const PRESET_ORDER: PresetId[] = [
  "rapido",
  "clasico",
  "doble9",
  "mesa-completa",
];

export function presetById(id: string | null | undefined): Preset | null {
  if (!id) return null;
  return (PRESETS as Record<string, Preset>)[id] ?? null;
}

/**
 * Presets nombrados compatibles con una regla de conteo (excluye "personalizado").
 */
export function presetsForCountRule(rule: CountRule): Preset[] {
  return PRESET_ORDER.map((id) => PRESETS[id]).filter((p) => p.countRule === rule);
}

/**
 * Deriva el CountRule a partir de una modality legacy.
 *   pri → 'mesa'
 *   ven | dom | cub | custom | null | any → 'rival'
 */
export function countRuleFromLegacyModality(
  code: string | null | undefined,
): CountRule {
  return code === "pri" ? "mesa" : "rival";
}

/**
 * Reconstruye el preset a partir de los 4 campos persistidos.
 * Devuelve null si los valores no coinciden con ningún preset nombrado.
 */
export function matchPreset(config: {
  count_rule: CountRule | string | null | undefined;
  set_size: SetCode | string | null | undefined;
  target_points: number | null | undefined;
  capicua_bonus: number | null | undefined;
}): Preset | null {
  const { count_rule, set_size, target_points, capicua_bonus } = config;
  if (!count_rule || !set_size || target_points == null || capicua_bonus == null) {
    return null;
  }
  for (const id of PRESET_ORDER) {
    const p = PRESETS[id];
    if (
      p.countRule === count_rule &&
      p.set === set_size &&
      p.target === target_points &&
      p.capicua === capicua_bonus
    ) {
      return p;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Legacy — MODALIDADES por país (deprecated, solo lectura de históricos)
// ────────────────────────────────────────────────────────────────

/** @deprecated Preferir `PRESETS` + `CountRule`. */
export type Modality = {
  code: ModalityCode;
  name: string;
  flag: string;
  country: CountryCode | null;
  set: SetCode;
  target: number;
  capicua: number;
  format: FormatCode;
  desc: string;
};

/** @deprecated Preferir `PRESETS`. Se conserva para renderizar datos históricos que aún guardan `matches.modality`. */
export const MODALIDADES: Record<ModalityCode, Modality> = {
  ven:    { code: "ven", name: "Venezolano",     flag: "🇻🇪", country: "VE", set: "d6", target: 100, capicua: 30, format: "doubles", desc: "Doble-seis · 100 pts · capicúa +30 · 2v2" },
  dom:    { code: "dom", name: "Dominicano",     flag: "🇩🇴", country: "DO", set: "d6", target: 200, capicua: 30, format: "doubles", desc: "Doble-seis · 200 pts · capicúa +30 · 2v2" },
  cub:    { code: "cub", name: "Cubano",         flag: "🇨🇺", country: "CU", set: "d9", target: 150, capicua: 30, format: "doubles", desc: "Doble-nueve · 150 pts · capicúa +30 · 2v2" },
  pri:    { code: "pri", name: "Puertorriqueño", flag: "🇵🇷", country: "PR", set: "d6", target: 200, capicua: 50, format: "doubles", desc: "Doble-seis · 200 pts · capicúa +50 · 2v2" },
  custom: { code: "custom", name: "Personalizado", flag: "⚙️", country: null, set: "d6", target: 100, capicua: 30, format: "doubles", desc: "Ajusta los parámetros manualmente" },
};

export type Country = {
  code: CountryCode;
  name: string;
  flag: string;
  /** @deprecated Preferir `suggestedPreset`. */
  suggested: ModalityCode;
  /** Preset sugerido para el país (usado por onboarding para precargar los 4 defaults del usuario). */
  suggestedPreset: PresetId;
};

export const COUNTRIES: Country[] = [
  { code: "VE", name: "Venezuela",         flag: "🇻🇪", suggested: "ven",    suggestedPreset: "rapido" },
  { code: "DO", name: "Rep. Dominicana",   flag: "🇩🇴", suggested: "dom",    suggestedPreset: "clasico" },
  { code: "CU", name: "Cuba",              flag: "🇨🇺", suggested: "cub",    suggestedPreset: "doble9" },
  { code: "PR", name: "Puerto Rico",       flag: "🇵🇷", suggested: "pri",    suggestedPreset: "mesa-completa" },
  { code: "CO", name: "Colombia",          flag: "🇨🇴", suggested: "ven",    suggestedPreset: "rapido" },
  { code: "MX", name: "México",            flag: "🇲🇽", suggested: "dom",    suggestedPreset: "clasico" },
  { code: "PA", name: "Panamá",            flag: "🇵🇦", suggested: "ven",    suggestedPreset: "rapido" },
  { code: "ES", name: "España",            flag: "🇪🇸", suggested: "dom",    suggestedPreset: "clasico" },
  { code: "US", name: "Estados Unidos",    flag: "🇺🇸", suggested: "dom",    suggestedPreset: "clasico" },
  { code: "AR", name: "Argentina",         flag: "🇦🇷", suggested: "custom", suggestedPreset: "personalizado" },
  { code: "CL", name: "Chile",             flag: "🇨🇱", suggested: "custom", suggestedPreset: "personalizado" },
  { code: "PE", name: "Perú",              flag: "🇵🇪", suggested: "custom", suggestedPreset: "personalizado" },
  { code: "OT", name: "Otro",              flag: "🌎", suggested: "custom", suggestedPreset: "personalizado" },
];

/** @deprecated Usar `countRuleFromLegacyModality` + `PRESETS`. */
export function modalityByCode(code: string | null | undefined): Modality {
  if (code && code in MODALIDADES) return MODALIDADES[code as ModalityCode];
  return MODALIDADES.custom;
}

export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

/**
 * Columnas de rating en `profiles` para el bucket doubles según set.
 * Post-Fase-A: el parámetro `format` se ignora — singles no existe.
 * NOTA: rating es por set, NO por count_rule.
 */
export function ratingColumnBase(set: SetCode, _format?: FormatCode): string {
  return set === "d6" ? "doubles" : "d9_doubles";
}

/**
 * Helper para el view profile_ratings: prefijo del bucket doubles según set.
 */
export function viewRatingPrefix(set: SetCode, _format?: FormatCode): string {
  return `${set}_doubles`;
}
