import type { Pair, Match, PairStanding } from './swiss-types';

/**
 * Derives standings from all pairs and all completed/bye matches.
 *
 * Scoring model (dominó federado — FMD/USA Domino Federation):
 *   • wins: +1 per finished win, +1 per bye.
 *   • losses: +1 per finished loss. Byes do NOT count as losses.
 *   • effectivenessCoefficient (CE):
 *       winner: + (1 − loserScore / targetPoints)
 *       loser:  − (1 − loserScore / targetPoints)
 *       bye:    0 (neutral — no real opponent)
 *   • pointsScored:
 *       winner: min(winnerScore, targetPoints)   ← "sin excedido" cap
 *       loser:  loserScore                        ← actual partial score
 *       bye:    0                                 ← no points contribution
 *   • pointsConceded:
 *       winner: loserScore
 *       loser:  min(winnerScore, targetPoints)
 *       bye:    0
 *
 * Invariants enforced:
 *   • No draws in formal domino — throws if finished match has equal scores.
 *   • pending/in_progress matches are ignored.
 */
export function computeStandings(
  pairs: Pair[],
  matches: Match[],
  targetPoints: number,
): PairStanding[] {
  if (targetPoints <= 0) {
    throw new Error(`computeStandings: targetPoints must be > 0, got ${targetPoints}`);
  }

  const statsMap = new Map<string, PairStanding>();

  for (const pair of pairs) {
    statsMap.set(pair.id, {
      pairId: pair.id,
      wins: 0,
      losses: 0,
      effectivenessCoefficient: 0,
      pointsScored: 0,
      pointsConceded: 0,
      headToHeadResults: new Map(),
      hasHadBye: false,
      lastByeRound: null,
      withdrawn: pair.withdrawnAt !== null,
    });
  }

  for (const match of matches) {
    if (match.status === 'bye') {
      const recipient = statsMap.get(match.pairHomeId);
      if (!recipient) continue;
      recipient.wins += 1;
      recipient.hasHadBye = true;
      if (recipient.lastByeRound === null || match.roundNumber > recipient.lastByeRound) {
        recipient.lastByeRound = match.roundNumber;
      }
      continue;
    }

    if (match.status !== 'finished') continue;
    if (match.pairAwayId === null) continue;

    const homeScore = match.pairHomeScore ?? 0;
    const awayScore = match.pairAwayScore ?? 0;

    if (homeScore === awayScore) {
      throw new Error(
        `computeStandings: match ${match.id} finished with equal scores ` +
          `(${homeScore}-${awayScore}). Draws are not allowed in formal domino — ` +
          `the rulebook requires a tiebreak hand.`,
      );
    }

    const home = statsMap.get(match.pairHomeId);
    const away = statsMap.get(match.pairAwayId);

    const homeWon = homeScore > awayScore;
    const winnerScore = homeWon ? homeScore : awayScore;
    const loserScore = homeWon ? awayScore : homeScore;
    const cappedWinnerScore = Math.min(winnerScore, targetPoints);
    const cappedLoserScore = Math.min(loserScore, targetPoints);
    const ceDelta = 1 - cappedLoserScore / targetPoints;

    if (homeWon) {
      if (home) {
        home.wins += 1;
        home.effectivenessCoefficient += ceDelta;
        home.pointsScored += cappedWinnerScore;
        home.pointsConceded += loserScore;
        if (match.pairAwayId) home.headToHeadResults.set(match.pairAwayId, 'win');
      }
      if (away) {
        away.losses += 1;
        away.effectivenessCoefficient -= ceDelta;
        away.pointsScored += loserScore;
        away.pointsConceded += cappedWinnerScore;
        away.headToHeadResults.set(match.pairHomeId, 'loss');
      }
    } else {
      if (away) {
        away.wins += 1;
        away.effectivenessCoefficient += ceDelta;
        away.pointsScored += cappedWinnerScore;
        away.pointsConceded += loserScore;
        away.headToHeadResults.set(match.pairHomeId, 'win');
      }
      if (home) {
        home.losses += 1;
        home.effectivenessCoefficient -= ceDelta;
        home.pointsScored += loserScore;
        home.pointsConceded += cappedWinnerScore;
        if (match.pairAwayId) home.headToHeadResults.set(match.pairAwayId, 'loss');
      }
    }
  }

  return Array.from(statsMap.values());
}
