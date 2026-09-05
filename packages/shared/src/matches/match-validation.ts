export type MatchValidation =
  | { status: 'in_progress'; reason: 'goal_not_reached' }
  | { status: 'tied_at_goal'; reason: 'must_play_tiebreaker' }
  | { status: 'finishable'; winnerTeam: 1 | 2 }
  | { status: 'time_expired_finishable'; winnerTeam: 1 | 2 | null };
  //                                                ^ null = puntaje igual, requiere desempate

/**
 * Determina si una partida puede cerrarse dados los puntajes actuales.
 *
 * @param timeExpired - Si el tiempo del partido expiró. Cuando es `true`,
 *   la función ignora la meta y resuelve por mayor puntaje.
 *   - winnerTeam: 1 | 2 si hay diferencia de puntos
 *   - winnerTeam: null si están empatados (la UI debe pedir desempate)
 */
export function validateMatchClosure(
  scoreTeam1: number,
  scoreTeam2: number,
  goal: number,
  timeExpired = false,
): MatchValidation {
  const s1 = Number(scoreTeam1);
  const s2 = Number(scoreTeam2);
  const g  = Number(goal);

  if (timeExpired) {
    if (s1 === s2) return { status: 'time_expired_finishable', winnerTeam: null };
    return { status: 'time_expired_finishable', winnerTeam: s1 > s2 ? 1 : 2 };
  }

  const team1Reached = s1 >= g;
  const team2Reached = s2 >= g;

  if (!team1Reached && !team2Reached) {
    return { status: 'in_progress', reason: 'goal_not_reached' };
  }
  if (s1 === s2) {
    return { status: 'tied_at_goal', reason: 'must_play_tiebreaker' };
  }
  return {
    status: 'finishable',
    winnerTeam: s1 > s2 ? 1 : 2,
  };
}
