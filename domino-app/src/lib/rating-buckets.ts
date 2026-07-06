import type { SetCode, FormatCode } from "@/lib/modalidades";

/**
 * Mapeo (set + format) -> columna en profiles.
 * Post-Fase-A: solo doubles. El parámetro `format` se ignora (siempre 'doubles').
 *   - d6 -> columnas legacy `doubles_*`
 *   - d9 -> columnas `d9_doubles_*`
 */
export function ratingCol(
  set: SetCode,
  _format: FormatCode,
  suffix: "elo" | "mu" | "sigma" | "games" | "wins" | "losses",
): string {
  const base = set === "d6" ? "doubles" : "d9_doubles";
  return `${base}_${suffix}`;
}
