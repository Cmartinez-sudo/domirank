import type { CountRule, SetCode, FormatCode } from "@/lib/modalidades";

/**
 * Post-0106: el rating se indexa por count_rule (rival/mesa) en vez de
 * set_size. Los matches d9 legacy conservan su bucket `d9_doubles_*`
 * (route override por set_size='d9' en apply_match_rating).
 *
 * Ruta:
 *   set_size='d9'                  → d9_doubles_*    (legacy path)
 *   count_rule='mesa'              → mesa_doubles_*
 *   count_rule='rival' o null(d6)  → rival_doubles_*
 */
export type RatingBucket = "rival_doubles" | "mesa_doubles" | "d9_doubles";

export type BucketSuffix =
  | "elo" | "mu" | "sigma" | "games" | "wins" | "losses"
  | "points_won" | "points_lost";

/**
 * Devuelve el bucket que aplica a un match según sus 4 campos identitarios.
 * `count_rule` puede ser null en matches legacy (pre-0105); en ese caso se
 * deriva de `modality` con el mapeo estándar (pri → mesa, resto → rival).
 */
export function bucketForMatch(m: {
  set_size?: SetCode | string | null;
  count_rule?: CountRule | string | null;
  modality?: string | null;
}): RatingBucket {
  if (m.set_size === "d9") return "d9_doubles";
  if (m.count_rule === "mesa") return "mesa_doubles";
  if (m.count_rule == null && m.modality === "pri") return "mesa_doubles";
  return "rival_doubles";
}

/**
 * Nombre completo de columna en `profiles` para un bucket + sufijo.
 * Ej: bucketColumn("rival_doubles", "elo") → "rival_doubles_elo".
 */
export function bucketColumn(bucket: RatingBucket, suffix: BucketSuffix): string {
  return `${bucket}_${suffix}`;
}

/**
 * @deprecated Preferir `bucketForMatch(match)` + `bucketColumn(bucket, suffix)`.
 * Se conserva porque algunos callers legacy pasan set_size sin ver count_rule.
 * Transición: set='d9' → d9_doubles_* (legacy). Set='d6' → rival_doubles_*
 * (asume rival — mayoría del rating d6 histórico venía de partidas rival).
 */
export function ratingCol(
  set: SetCode,
  _format: FormatCode,
  suffix: BucketSuffix,
): string {
  const base: RatingBucket = set === "d9" ? "d9_doubles" : "rival_doubles";
  return `${base}_${suffix}`;
}
