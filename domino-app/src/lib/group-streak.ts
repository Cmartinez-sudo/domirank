/**
 * Cómputo de la racha activa de un jugador en un grupo.
 *
 * La racha es la cantidad de partidas más recientes con el mismo resultado
 * (W o L) contadas desde la partida más reciente hacia atrás, deteniéndose
 * en el primer resultado distinto.
 *
 * Ejemplo (más reciente primero): [W, W, L, W, W] → 2W (los 2 más recientes
 * son W, la tercera fue L).
 *
 * Reglas (decididas en grilling):
 *  - Byes NO cuentan (no aplica en grupos regulares; defensive check por si acaso).
 *  - Sin partidas → null (celda "—" en UI).
 *  - Sin cap; una racha de 15W se renderea como "15W".
 *  - Solo cuentan matches con status='confirmed' (el caller ya filtra).
 */

export type PlayerMatchResult = {
  /** ISO timestamp — orden cronológico. */
  finished_at: string;
  /** rank=1 → won; distinto de 1 → lost. */
  rank: number | null;
  /** Si el match fue un bye (sin oponente), se ignora para racha. */
  is_bye?: boolean;
};

export type StreakResult = {
  /** Longitud de la racha actual. */
  count: number;
  /** 'W' o 'L' según el último resultado. */
  outcome: "W" | "L";
};

/**
 * Compute la racha activa a partir de una lista de partidas del jugador.
 * El orden del input NO importa — ordenamos por finished_at DESC internamente.
 * Devuelve null si el jugador no tiene partidas válidas (o todas fueron byes).
 */
export function computeStreak(matches: PlayerMatchResult[]): StreakResult | null {
  const valid = matches
    .filter((m) => !m.is_bye && m.finished_at)
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at));

  if (valid.length === 0) return null;

  const mostRecent = valid[0]!;
  const currentOutcome: "W" | "L" = mostRecent.rank === 1 ? "W" : "L";

  let count = 0;
  for (const m of valid) {
    const thisOutcome: "W" | "L" = m.rank === 1 ? "W" : "L";
    if (thisOutcome !== currentOutcome) break;
    count += 1;
  }

  return { count, outcome: currentOutcome };
}
