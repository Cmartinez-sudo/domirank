/**
 * Motor de rating Domino — wrapper de OpenSkill.
 *
 * Modelo: Plackett-Luce con aproximaciones analíticas Weng-Lin.
 *   Weng & Lin (2011) "A Bayesian Approximation Method for Online Ranking".
 *
 * La librería `openskill` (npm) usa PlackettLuce como modelo por defecto.
 * Defaults (mismos que TrueSkill original):
 *   μ = 25.0   σ = 25/3 ≈ 8.3333   β = 25/6 ≈ 4.1667   τ = 25/300 ≈ 0.0833
 *
 * Rating "ordinal" visible al usuario = μ − 3σ.  Es conservador: representa el
 * skill que el modelo considera muy probable que el jugador tenga al menos.
 */

import { rating, rate, predictWin, ordinal, type Rating } from "openskill";

export type Player = {
  user_id: string;
  mu: number;
  sigma: number;
};

export type TeamInput = {
  team: number;       // 1, 2, 3...
  players: Player[];  // jugadores del equipo
  rank: number;       // 1 = ganador (menor es mejor)
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
export const DEFAULT_SIGMA = 25 / 3; // 8.3333...

export function newRating(): Rating {
  return rating({ mu: DEFAULT_MU, sigma: DEFAULT_SIGMA });
}

export function asOrdinal(mu: number, sigma: number): number {
  // OpenSkill's ordinal = mu - z*sigma (z=3 por defecto)
  return ordinal({ mu, sigma });
}

/**
 * Mínimo de partidas totales (singles + parejas) para entrar al ranking global.
 * Por debajo de esto, el global_ordinal no se considera confiable y no se muestra
 * en el leaderboard.
 */
export const DOMIRANK_MIN_GAMES = 5;

/**
 * Buckets de rating: singles/doubles × sets (doble-seis / doble-nueve).
 * Modalidades del mismo set comparten bucket porque la estructura estratégica
 * del juego es idéntica (solo cambian puntos meta y bonus capicúa).
 * Sets distintos = ratings separados (el espacio de acciones y la carga de
 * memoria son fundamentalmente distintos en doble-seis vs doble-nueve).
 */
export type Bucket = { mu: number; sigma: number; games?: number };
export type RatingBucketKey = 'd6_singles' | 'd6_doubles' | 'd9_singles' | 'd9_doubles';

export const RATING_BUCKETS: RatingBucketKey[] = ['d6_singles', 'd6_doubles', 'd9_singles', 'd9_doubles'];

/**
 * DomiRank Global: fusión Bayesiana inverse-variance de los 4 buckets.
 * Cada bucket es una estimación parcial del skill latente del jugador.
 *
 *   μ_global = Σ μ_i · p_i / Σ p_i      donde p_i = 1/σ²_i (precisión)
 *   σ²_global = 1 / Σ p_i
 *
 * Si un jugador nunca jugó un bucket, σ alto (default 8.33) hace que apenas
 * pese en el global. Sin casos especiales.
 */
export function globalRating(buckets: { [K in RatingBucketKey]: Bucket }): {
  mu: number;
  sigma: number;
  ordinal: number;
  weights: { [K in RatingBucketKey]: number };
} {
  let muNum = 0;
  let precSum = 0;
  const weights = {} as { [K in RatingBucketKey]: number };
  const precs = {} as { [K in RatingBucketKey]: number };
  for (const k of RATING_BUCKETS) {
    const b = buckets[k];
    const p = 1 / (b.sigma * b.sigma);
    precs[k] = p;
    muNum += b.mu * p;
    precSum += p;
  }
  for (const k of RATING_BUCKETS) weights[k] = precs[k] / precSum;
  const mu = muNum / precSum;
  const sigma = Math.sqrt(1 / precSum);
  return { mu, sigma, ordinal: mu - 3 * sigma, weights };
}

/**
 * Variante simplificada: pasa solo singles+doubles y asume d9 vacíos (defaults).
 * Mantiene compatibilidad con código que aún no diferencia por set.
 */
export function globalRatingFromTwoFormats(
  singlesMu: number, singlesSigma: number,
  doublesMu: number, doublesSigma: number,
) {
  return globalRating({
    d6_singles: { mu: singlesMu, sigma: singlesSigma },
    d6_doubles: { mu: doublesMu, sigma: doublesSigma },
    d9_singles: { mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
    d9_doubles: { mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
  });
}

/**
 * Recalcula μ/σ de todos los jugadores tras una partida.
 *
 * @param teams  Array de equipos con sus jugadores y rank final (1=ganador).
 *               Soporta cualquier número de equipos y tamaños (1v1, 2v2, FFA...).
 * @returns Array plano con el rating actualizado de cada jugador.
 *
 * Ejemplo singles (Alice gana a Bob):
 *   updateRatings([
 *     { team: 1, players: [{user_id: "alice", mu: 25, sigma: 8.33}], rank: 1 },
 *     { team: 2, players: [{user_id: "bob",   mu: 25, sigma: 8.33}], rank: 2 },
 *   ])
 */
export function updateRatings(teams: TeamInput[]): PlayerRatingUpdate[] {
  if (teams.length < 2) {
    throw new Error("Se necesitan al menos 2 equipos para calcular rating");
  }
  for (const t of teams) {
    if (t.players.length < 1) throw new Error(`El equipo ${t.team} no tiene jugadores`);
  }

  // openskill espera teams como Rating[][] y opcionalmente ranks
  const teamsRatings: Rating[][] = teams.map((t) =>
    t.players.map((p) => rating({ mu: p.mu, sigma: p.sigma }))
  );
  const ranks = teams.map((t) => t.rank);

  // PlackettLuce es el modelo por defecto; rank menor = mejor.
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

/**
 * Probabilidad de que el equipo A le gane al equipo B, según los ratings actuales.
 * Útil para mostrar "favorito" antes de la partida.
 */
export function winProbability(teamA: Player[], teamB: Player[]): number {
  const a: Rating[] = teamA.map((p) => rating({ mu: p.mu, sigma: p.sigma }));
  const b: Rating[] = teamB.map((p) => rating({ mu: p.mu, sigma: p.sigma }));
  const [pA] = predictWin([a, b]);
  return pA;
}
