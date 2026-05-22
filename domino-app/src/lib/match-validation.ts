export type MatchValidation =
  | { status: 'in_progress'; reason: 'goal_not_reached' }
  | { status: 'tied_at_goal'; reason: 'must_play_tiebreaker' }
  | { status: 'finishable'; winnerTeam: 1 | 2 };

export function validateMatchClosure(
  scoreTeam1: number,
  scoreTeam2: number,
  goal: number
): MatchValidation {
  const s1 = Number(scoreTeam1);
  const s2 = Number(scoreTeam2);
  const g  = Number(goal);

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
