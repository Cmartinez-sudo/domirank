import type { Pair, Match, PairStanding } from './swiss-types';

/**
 * Derives standings from the full set of pairs and all completed/bye matches.
 *
 * Scoring:
 *   win    → 3 pts
 *   draw   → 1 pt
 *   loss   → 0 pts
 *   bye    → 3 pts (treated as a forfeit win)
 *
 * Buchholz = sum of opponents' total points at the time of evaluation.
 * This is computed in a second pass once all individual points are known.
 *
 * Invariant: only matches with status 'finished' or 'bye' affect standings.
 * Matches still 'pending' or 'in_progress' are ignored.
 */
export function computeStandings(pairs: Pair[], matches: Match[]): PairStanding[] {
  // First pass: compute per-pair stats (points, margins, wins, draws, losses)
  // excluding buchholz (needs all points to be available first).
  const statsMap = new Map<string, Omit<PairStanding, 'buchholz'>>();

  for (const pair of pairs) {
    const isWithdrawn = pair.withdrawnAt !== null;
    const standing: Omit<PairStanding, 'buchholz'> = {
      pairId: pair.id,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      marginOfVictory: 0,
      headToHeadResults: new Map(),
      hasHadBye: false,
      withdrawn: isWithdrawn,
    };
    statsMap.set(pair.id, standing);
  }

  // Process each relevant match.
  for (const match of matches) {
    if (match.status === 'bye') {
      // The pair receiving the bye is always pair_home_id.
      const home = statsMap.get(match.pairHomeId);
      if (home) {
        home.points += 3;
        home.wins += 1;
        home.hasHadBye = true;
      }
      continue;
    }

    if (match.status !== 'finished') continue;
    if (match.pairAwayId === null) continue;

    const homeScore = match.pairHomeScore ?? 0;
    const awayScore = match.pairAwayScore ?? 0;
    const home = statsMap.get(match.pairHomeId);
    const away = statsMap.get(match.pairAwayId);

    if (home) {
      const margin = homeScore - awayScore;
      home.marginOfVictory += margin;
      if (homeScore > awayScore) {
        home.points += 3;
        home.wins += 1;
        home.headToHeadResults.set(match.pairAwayId, 'win');
      } else if (homeScore === awayScore) {
        home.points += 1;
        home.draws += 1;
        home.headToHeadResults.set(match.pairAwayId, 'draw');
      } else {
        home.losses += 1;
        home.headToHeadResults.set(match.pairAwayId, 'loss');
      }
    }

    if (away) {
      const margin = awayScore - homeScore;
      away.marginOfVictory += margin;
      if (awayScore > homeScore) {
        away.points += 3;
        away.wins += 1;
        away.headToHeadResults.set(match.pairHomeId, 'win');
      } else if (awayScore === homeScore) {
        away.points += 1;
        away.draws += 1;
        away.headToHeadResults.set(match.pairHomeId, 'draw');
      } else {
        away.losses += 1;
        away.headToHeadResults.set(match.pairHomeId, 'loss');
      }
    }
  }

  // Second pass: compute buchholz = sum of opponents' points.
  const result: PairStanding[] = [];

  for (const pair of pairs) {
    const stats = statsMap.get(pair.id);
    if (!stats) continue;

    let buchholz = 0;
    for (const match of matches) {
      if (match.status !== 'finished' && match.status !== 'bye') continue;

      const isHome = match.pairHomeId === pair.id;
      const isAway = match.pairAwayId === pair.id;

      if (!isHome && !isAway) continue;

      // Bye matches have no real opponent — buchholz contribution is 0.
      if (match.status === 'bye') continue;

      const opponentId = isHome ? match.pairAwayId! : match.pairHomeId;
      const opponentStats = statsMap.get(opponentId);
      if (opponentStats) {
        buchholz += opponentStats.points;
      }
    }

    result.push({ ...stats, buchholz });
  }

  return result;
}
