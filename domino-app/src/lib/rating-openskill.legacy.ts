/**
 * LEGACY — Motor de rating OpenSkill (Plackett-Luce / Weng-Lin).
 * Archivado durante la migración a Elo (mayo 2025).
 * NO importar en código nuevo. Mantener solo para referencia.
 *
 * Reemplazado por: src/lib/rating.ts (motor Elo con MoV FiveThirtyEight).
 */

import { rating, rate, predictWin, ordinal, type Rating } from "openskill";

export type Player = {
  user_id: string;
  mu: number;
  sigma: number;
};

export type TeamInput = {
  team: number;
  players: Player[];
  rank: number;
};

export type PlayerRatingUpdate = {
  user_id: string;
  team: number;
  rank: number;
  mu_before: number;
  sigma_before: number;
  mu_after: number;
  sigma_after: number;
  ordinal_before: number;
  ordinal_after: number;
};

export const DEFAULT_MU = 25.0;
export const DEFAULT_SIGMA = 25 / 3;

export function newRating(): Rating {
  return rating({ mu: DEFAULT_MU, sigma: DEFAULT_SIGMA });
}

export function asOrdinal(mu: number, sigma: number): number {
  return ordinal({ mu, sigma });
}

export const DOMIRANK_MIN_GAMES = 5;

export type Bucket = { mu: number; sigma: number; games?: number };
export type RatingBucketKey = 'd6_singles' | 'd6_doubles' | 'd9_singles' | 'd9_doubles';

export const RATING_BUCKETS: RatingBucketKey[] = ['d6_singles', 'd6_doubles', 'd9_singles', 'd9_doubles'];

export function globalRating(buckets: { [K in RatingBucketKey]: Bucket }): {
  mu: number;
  sigma: number;
  ordinal: number;
  weights: { [K in RatingBucketKey]: number };
} {
  let muNum = 0;
  let precSum = 0;
  const precs = {} as { [K in RatingBucketKey]: number };
  const weights = {} as { [K in RatingBucketKey]: number };
  for (const k of RATING_BUCKETS) {
    const b = buckets[k];
    const played = (b.games ?? 0) > 0;
    const p = played ? 1 / (b.sigma * b.sigma) : 0;
    precs[k] = p;
    if (played) {
      muNum += b.mu * p;
      precSum += p;
    }
  }
  if (precSum === 0) {
    for (const k of RATING_BUCKETS) weights[k] = 0;
    return {
      mu: DEFAULT_MU,
      sigma: DEFAULT_SIGMA,
      ordinal: DEFAULT_MU - 3 * DEFAULT_SIGMA,
      weights,
    };
  }
  for (const k of RATING_BUCKETS) weights[k] = precs[k] / precSum;
  const mu = muNum / precSum;
  const sigma = Math.sqrt(1 / precSum);
  return { mu, sigma, ordinal: mu - 3 * sigma, weights };
}

export function globalRatingFromTwoFormats(
  singlesMu: number, singlesSigma: number, singlesGames: number,
  doublesMu: number, doublesSigma: number, doublesGames: number,
) {
  return globalRating({
    d6_singles: { mu: singlesMu, sigma: singlesSigma, games: singlesGames },
    d6_doubles: { mu: doublesMu, sigma: doublesSigma, games: doublesGames },
    d9_singles: { mu: DEFAULT_MU, sigma: DEFAULT_SIGMA, games: 0 },
    d9_doubles: { mu: DEFAULT_MU, sigma: DEFAULT_SIGMA, games: 0 },
  });
}

export function updateRatings(teams: TeamInput[]): PlayerRatingUpdate[] {
  if (teams.length < 2) {
    throw new Error("Se necesitan al menos 2 equipos para calcular rating");
  }
  for (const t of teams) {
    if (t.players.length < 1) throw new Error(`El equipo ${t.team} no tiene jugadores`);
  }

  const teamsRatings: Rating[][] = teams.map((t) =>
    t.players.map((p) => rating({ mu: p.mu, sigma: p.sigma }))
  );
  const ranks = teams.map((t) => t.rank);
  const updated = rate(teamsRatings, { rank: ranks });

  const out: PlayerRatingUpdate[] = [];
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const beforeTeam = teamsRatings[i];
    const afterTeam  = updated[i];
    for (let j = 0; j < t.players.length; j++) {
      const p = t.players[j];
      const before = beforeTeam[j];
      const after  = afterTeam[j];
      out.push({
        user_id: p.user_id,
        team: t.team,
        rank: t.rank,
        mu_before: before.mu,
        sigma_before: before.sigma,
        mu_after: after.mu,
        sigma_after: after.sigma,
        ordinal_before: asOrdinal(before.mu, before.sigma),
        ordinal_after:  asOrdinal(after.mu, after.sigma),
      });
    }
  }
  return out;
}

const TOP_ORDINAL = 28;

export function toDisplayRating(ord: number): number {
  if (!isFinite(ord)) return 1.0;
  const raw = 1 + (ord / TOP_ORDINAL) * 19;
  return Math.max(1.0, Math.min(20.0, Math.round(raw * 10) / 10));
}

export function displayToOrdinal(display: number): number {
  return ((display - 1) / 19) * TOP_ORDINAL;
}

export const SKILL_TIERS = [
  { min: 1,    max: 3.9,  name: "Aprendiz",   color: "#94a3b8" },
  { min: 4,    max: 6.9,  name: "Casual",     color: "#10b981" },
  { min: 7,    max: 9.9,  name: "Habilidoso", color: "#3b82f6" },
  { min: 10,   max: 12.9, name: "Veterano",   color: "#8b5cf6" },
  { min: 13,   max: 15.9, name: "Maestro",    color: "#f59e0b" },
  { min: 16,   max: 17.9, name: "Élite",      color: "#ef4444" },
  { min: 18,   max: 20,   name: "Leyenda",    color: "#fbbf24" },
] as const;

export type SkillTier = typeof SKILL_TIERS[number];

export function tierFor(display: number): SkillTier {
  return SKILL_TIERS.find((t) => display >= t.min && display <= t.max) ?? SKILL_TIERS[0];
}

export function initialRatingFromAssessment(points: number): { mu: number; sigma: number; estimatedDisplay: number } {
  if (points <= 2)  return { mu: 22,   sigma: 7.5, estimatedDisplay: 3  };
  if (points <= 5)  return { mu: 25,   sigma: 7.0, estimatedDisplay: 6  };
  if (points <= 8)  return { mu: 28,   sigma: 6.5, estimatedDisplay: 9  };
  if (points <= 10) return { mu: 31,   sigma: 5.5, estimatedDisplay: 13 };
  return               { mu: 33,   sigma: 4.5, estimatedDisplay: 16 };
}

export function winProbability(teamA: Player[], teamB: Player[]): number {
  const a: Rating[] = teamA.map((p) => rating({ mu: p.mu, sigma: p.sigma }));
  const b: Rating[] = teamB.map((p) => rating({ mu: p.mu, sigma: p.sigma }));
  const [pA] = predictWin([a, b]);
  return pA;
}
