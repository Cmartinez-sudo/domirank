/**
 * Motor de rating DomiRank — Elo clásico con MoV multiplier FiveThirtyEight.
 *
 * Reemplaza OpenSkill (Plackett-Luce / Weng-Lin) en mayo 2025.
 * El legacy OpenSkill está archivado en rating-openskill.legacy.ts.
 *
 * Matemática:
 *   team_elo = avg(partners)
 *   expected = 1 / (1 + 10^((opp - me) / 400))
 *   MOVM = ln(|score_winner - score_loser| + 1) * (2.2 / (elo_gap * 0.001 + 2.2))
 *   delta = K * MOVM * (actual - expected)
 *
 * Display 1–20: 1 + ((elo - 1000) / 1200) * 19  — clamp [1, 20].
 * Global Elo:   weighted average by games_played per bucket (only games > 0).
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Starting Elo for every new player in every bucket. */
export const DEFAULT_ELO = 1500;

/** Games-played threshold below which a player is Provisional in a bucket. */
export const PROVISIONAL_THRESHOLD = 10;

/** Minimum total games (all buckets) to appear in the global leaderboard. */
export const DOMIRANK_MIN_GAMES = 5;

/** K-factor ladder (Provisional always wins over tier). */
export const K_FACTORS = {
  PROVISIONAL: 40,  // games_played < PROVISIONAL_THRESHOLD
  LEARNING:    28,  // elo < 1500
  STABLE:      24,  // elo 1500 – 1899
  ELITE:       18,  // elo 1900 – 2049
  LEGEND:      12,  // elo >= 2050
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Player = {
  user_id: string;
  elo: number;
  games_played: number;
};

export type TeamInput = {
  team: number;
  players: Player[];
  /** 1 = winner, 2 = loser (only 2 teams supported). */
  rank: 1 | 2;
  /** Total points scored by this team in the match (for MoV). */
  score: number;
};

export type PlayerRatingUpdate = {
  user_id: string;
  team: number;
  elo_before: number;
  elo_after: number;
  games_before: number;
  games_after: number;
  k_used: number;
};

export type RatingBucketKey = 'd6_singles' | 'd6_doubles' | 'd9_singles' | 'd9_doubles';

export const RATING_BUCKETS: RatingBucketKey[] = [
  'd6_singles', 'd6_doubles', 'd9_singles', 'd9_doubles',
];

// ─── K-factor ────────────────────────────────────────────────────────────────

/**
 * Returns the K-factor for a player.
 * Provisional status (games_played < PROVISIONAL_THRESHOLD) always wins
 * over tier — even a Leyenda has K=40 in their first 10 games of a new bucket.
 */
export function kFactorFor(player: { elo: number; games_played: number }): number {
  if (player.games_played < PROVISIONAL_THRESHOLD) return K_FACTORS.PROVISIONAL;
  if (player.elo < 1500)  return K_FACTORS.LEARNING;
  if (player.elo < 1900)  return K_FACTORS.STABLE;
  if (player.elo < 2050)  return K_FACTORS.ELITE;
  return K_FACTORS.LEGEND;
}

// ─── Core Elo computation ────────────────────────────────────────────────────

/** Expected win probability for team with `myElo` vs `opponentElo`. */
function expected(myElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
}

/** Average Elo of a team (identical to individual Elo in 1v1). */
function teamAvgElo(players: Player[]): number {
  return players.reduce((s, p) => s + p.elo, 0) / players.length;
}

/**
 * Margin of Victory multiplier — FiveThirtyEight autocorrelation-corrected,
 * recalibrated para los rangos de score del dominó (5-100 vs 5-15 NBA).
 *
 * Diferencia vs FiveThirtyEight original: usamos log10 en vez de ln para que
 * los diffs típicos de dominó (20-50 pts) no inflen el delta. Con ln un partido
 * normal daba ~37 pts de cambio; con log10 da ~16 (rango Elo estable).
 *
 * El término `2.2 / (...)` es autocorrelation correction: evita que favoritos
 * inflen su rating ganando por mucho a underdogs.
 *
 * @param scoreDiff Absolute difference in scores between winner and loser.
 * @param eloGap    winner_team_elo - loser_team_elo (can be negative for upsets).
 */
function movMultiplier(scoreDiff: number, eloGap: number): number {
  return Math.log10(scoreDiff + 1) * (2.2 / (eloGap * 0.001 + 2.2));
}

// ─── updateRatings ───────────────────────────────────────────────────────────

/**
 * Calculates new Elo for all players after a 2-team match.
 *
 * Doubles (2v2): team_elo = avg(partners). Both partners move identically.
 * Singles (1v1): team_elo = individual elo. Same formula.
 * FFA (>2 teams): throws — not yet supported.
 *
 * Each player's K-factor is evaluated independently at the moment of the update.
 */
export function updateRatings(teams: TeamInput[]): PlayerRatingUpdate[] {
  if (teams.length !== 2) {
    throw new Error("updateRatings soporta exactamente 2 equipos por ahora");
  }
  for (const t of teams) {
    if (t.players.length < 1) {
      throw new Error(`El equipo ${t.team} no tiene jugadores`);
    }
  }

  const [t1, t2] = teams.sort((a, b) => a.team - b.team);
  const winner = t1.rank === 1 ? t1 : t2;
  const loser  = t1.rank === 1 ? t2 : t1;

  const winnerElo = teamAvgElo(winner.players);
  const loserElo  = teamAvgElo(loser.players);

  const scoreDiff = Math.abs(winner.score - loser.score);
  const eloGap    = winnerElo - loserElo;
  const movm      = movMultiplier(scoreDiff, eloGap);

  const expWinner = expected(winnerElo, loserElo);
  const expLoser  = expected(loserElo, winnerElo);

  const out: PlayerRatingUpdate[] = [];

  for (const player of winner.players) {
    const k = kFactorFor(player);
    const delta = Math.round(k * movm * (1 - expWinner));
    out.push({
      user_id:      player.user_id,
      team:         winner.team,
      elo_before:   player.elo,
      elo_after:    player.elo + delta,
      games_before: player.games_played,
      games_after:  player.games_played + 1,
      k_used:       k,
    });
  }

  for (const player of loser.players) {
    const k = kFactorFor(player);
    const delta = Math.round(k * movm * (0 - expLoser));
    out.push({
      user_id:      player.user_id,
      team:         loser.team,
      elo_before:   player.elo,
      elo_after:    player.elo + delta,
      games_before: player.games_played,
      games_after:  player.games_played + 1,
      k_used:       k,
    });
  }

  return out;
}

// ─── Global rating ───────────────────────────────────────────────────────────

/**
 * Calculates DomiRank Global as a weighted average of buckets with games > 0.
 * Buckets with 0 games are excluded to avoid dragging the global to DEFAULT_ELO.
 *
 * Returns `display: null` when total_games < DOMIRANK_MIN_GAMES (unranked).
 */
export function globalRating(
  buckets: Record<RatingBucketKey, { elo: number; games_played: number }>,
): { elo: number; games_played: number; display: number | null } {
  let weightedSum = 0;
  let totalGames  = 0;

  for (const k of RATING_BUCKETS) {
    const b = buckets[k];
    if (b.games_played > 0) {
      weightedSum += b.elo * b.games_played;
      totalGames  += b.games_played;
    }
  }

  if (totalGames === 0) {
    return { elo: DEFAULT_ELO, games_played: 0, display: null };
  }

  const elo = Math.round(weightedSum / totalGames);
  const display = totalGames >= DOMIRANK_MIN_GAMES ? toDisplayRating(elo) : null;
  return { elo, games_played: totalGames, display };
}

// ─── Display mapping ─────────────────────────────────────────────────────────

/**
 * Maps Elo to the 1–20 DomiRank display scale.
 * Anchors: Elo 1000 → 1.0, Elo 2200 → 20.0.
 */
export function toDisplayRating(elo: number): number {
  if (!isFinite(elo)) return 1.0;
  const raw = 1 + ((elo - 1000) / 1200) * 19;
  return Math.max(1.0, Math.min(20.0, Math.round(raw * 10) / 10));
}

/**
 * Inverse of toDisplayRating — useful for tests and threshold calculations.
 */
export function displayToElo(display: number): number {
  return 1000 + ((display - 1) / 19) * 1200;
}

// ─── Tiers ───────────────────────────────────────────────────────────────────

export const SKILL_TIERS = [
  { min: 1.0, max: 3.9,  name: "Aprendiz",   color: "#94a3b8" },
  { min: 4.0, max: 6.9,  name: "Casual",     color: "#10b981" },
  { min: 7.0, max: 9.9,  name: "Habilidoso", color: "#3b82f6" },
  { min: 10.0, max: 12.9, name: "Veterano",  color: "#8b5cf6" },
  { min: 13.0, max: 15.9, name: "Maestro",   color: "#f59e0b" },
  { min: 16.0, max: 17.9, name: "Élite",     color: "#ef4444" },
  { min: 18.0, max: 20.0, name: "Leyenda",   color: "#fbbf24" },
] as const;

export type SkillTier = typeof SKILL_TIERS[number];

/** Returns the tier for a given display rating (1–20). */
export function tierFor(display: number): SkillTier {
  return SKILL_TIERS.find((t) => display >= t.min && display <= t.max) ?? SKILL_TIERS[0];
}

// ─── Win probability ─────────────────────────────────────────────────────────

/**
 * Returns the probability (0–1) that teamA beats teamB, based on current Elos.
 * Uses average Elo per team, same formula as the update step.
 */
export function winProbability(teamA: Player[], teamB: Player[]): number {
  return expected(teamAvgElo(teamA), teamAvgElo(teamB));
}

// ─── Initial rating from assessment ──────────────────────────────────────────

/**
 * Maps skill-assessment points (0–12) to a starting Elo.
 * Players with no assessment start at DEFAULT_ELO = 1500.
 *
 * | Points | Elo  | Estimated tier |
 * |--------|------|----------------|
 * | 0–2    | 1300 | Aprendiz       |
 * | 3–5    | 1450 | Casual         |
 * | 6–8    | 1550 | Habilidoso     |
 * | 9–10   | 1700 | Veterano       |
 * | 11–12  | 1850 | Maestro        |
 */
export function initialRatingFromAssessment(points: number): {
  elo: number;
  estimatedDisplay: number;
} {
  let elo: number;
  if (points <= 2)       elo = 1300;
  else if (points <= 5)  elo = 1450;
  else if (points <= 8)  elo = 1550;
  else if (points <= 10) elo = 1700;
  else                   elo = 1850;

  return { elo, estimatedDisplay: toDisplayRating(elo) };
}
