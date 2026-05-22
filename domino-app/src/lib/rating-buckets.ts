import type { SetCode, FormatCode } from "@/lib/modalidades";

// Mapeo (set + formato) -> columna en profiles.
// d6 usa columnas legacy `singles_*` / `doubles_*`.
// d9 usa columnas nuevas `d9_singles_*` / `d9_doubles_*`.
export function ratingCol(
  set: SetCode,
  format: FormatCode,
  suffix: "elo" | "mu" | "sigma" | "games" | "wins" | "losses",
): string {
  const base = set === "d6"
    ? (format === "singles" ? "singles" : "doubles")
    : (format === "singles" ? "d9_singles" : "d9_doubles");
  return `${base}_${suffix}`;
}
