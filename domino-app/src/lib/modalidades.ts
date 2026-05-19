/**
 * Modalidades de juego de dominó disponibles en DomiRank.
 *
 * Diseño:
 *   - Modalidades con el MISMO set (doble-seis) comparten bucket de rating:
 *     Venezolano, Dominicano, Puertorriqueño usan el bucket d6_*.
 *     La razón es que la estructura estratégica es idéntica; solo cambian
 *     puntos meta y bonus capicúa.
 *   - Sets distintos (doble-nueve cubano) tienen buckets separados porque
 *     el espacio de acciones y la carga de memoria difieren.
 */

export type SetCode = "d6" | "d9";
export type ModalityCode = "ven" | "dom" | "cub" | "pri" | "custom";
export type CountryCode =
  | "VE" | "DO" | "CU" | "PR" | "CO" | "MX" | "PA"
  | "ES" | "US" | "AR" | "CL" | "PE" | "OT";

export type FormatCode = "singles" | "doubles";

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
  suggested: ModalityCode;
};

export const COUNTRIES: Country[] = [
  { code: "VE", name: "Venezuela",         flag: "🇻🇪", suggested: "ven" },
  { code: "DO", name: "Rep. Dominicana",   flag: "🇩🇴", suggested: "dom" },
  { code: "CU", name: "Cuba",              flag: "🇨🇺", suggested: "cub" },
  { code: "PR", name: "Puerto Rico",       flag: "🇵🇷", suggested: "pri" },
  { code: "CO", name: "Colombia",          flag: "🇨🇴", suggested: "ven" },
  { code: "MX", name: "México",            flag: "🇲🇽", suggested: "dom" },
  { code: "PA", name: "Panamá",            flag: "🇵🇦", suggested: "ven" },
  { code: "ES", name: "España",            flag: "🇪🇸", suggested: "dom" },
  { code: "US", name: "Estados Unidos",    flag: "🇺🇸", suggested: "dom" },
  { code: "AR", name: "Argentina",         flag: "🇦🇷", suggested: "custom" },
  { code: "CL", name: "Chile",             flag: "🇨🇱", suggested: "custom" },
  { code: "PE", name: "Perú",              flag: "🇵🇪", suggested: "custom" },
  { code: "OT", name: "Otro",              flag: "🌎", suggested: "custom" },
];

export function modalityByCode(code: string | null | undefined): Modality {
  if (code && code in MODALIDADES) return MODALIDADES[code as ModalityCode];
  return MODALIDADES.custom;
}

export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

/**
 * Columnas de rating en `profiles` para una combinación de set + formato.
 * Devuelve las claves base; los campos completos son `${base}_mu`, `${base}_sigma`,
 * `${base}_games`, `${base}_wins`, `${base}_losses`.
 */
export function ratingColumnBase(set: SetCode, format: FormatCode): string {
  // d6 usa las columnas legacy `singles_*` y `doubles_*` (pre-migración 0004)
  // d9 usa `d9_singles_*` y `d9_doubles_*`
  if (set === "d6") return format === "singles" ? "singles" : "doubles";
  return format === "singles" ? "d9_singles" : "d9_doubles";
}

/**
 * Helper para el view profile_ratings que expone los 4 buckets con prefijos
 * consistentes (d6_singles_*, d6_doubles_*, d9_singles_*, d9_doubles_*).
 */
export function viewRatingPrefix(set: SetCode, format: FormatCode): string {
  return `${set}_${format}`;
}
