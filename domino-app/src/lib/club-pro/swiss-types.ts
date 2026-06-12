import type { Database } from '@/types/supabase';

// ─── DB Row aliases ────────────────────────────────────────────────────────────

export type PairRow = Database['public']['Tables']['org_tournament_pairs']['Row'];
export type MatchRow = Database['public']['Tables']['org_tournament_matches']['Row'];

// ─── Engine input types ────────────────────────────────────────────────────────
//
// Lean projections of DB rows. Phase-3 callers (server actions) map
// PairRow/MatchRow → Pair/Match before invoking the engine.

export interface Pair {
  id: string;
  initialSeed: number | null;
  withdrawnAt: string | null;
}

export interface Match {
  id: string;
  pairHomeId: string;
  /** null means this match IS the bye record (pair_away_id IS NULL in DB) */
  pairAwayId: string | null;
  pairHomeScore: number | null;
  pairAwayScore: number | null;
  /** Only 'finished' | 'bye' contribute to standings */
  status: 'pending' | 'in_progress' | 'finished' | 'bye';
  /**
   * Round number (1-indexed). Required so the engine can implement
   * strict-rotation bye assignment (oldest bye gets the next one when all
   * pairs have already had one).
   *
   * IMPORTANT for Phase-3 callers: this is NOT a column on
   * `org_tournament_matches`. The DB stores `round_id` (FK to
   * `org_tournament_rounds`). Callers MUST resolve via JOIN before
   * projecting, e.g.:
   *
   *   SELECT m.*, r.round_number
   *     FROM org_tournament_matches m
   *     JOIN org_tournament_rounds r ON r.id = m.round_id
   *
   * Passing `roundNumber: 0` (default) silently breaks bye rotation —
   * `lastByeRound` would never advance and the rotation fallback would
   * always treat all byes as "round 0" (same era).
   */
  roundNumber: number;
}

// ─── Standings ─────────────────────────────────────────────────────────────────

export interface PairStanding {
  pairId: string;
  /** Matches won (including byes). Primary sort. */
  wins: number;
  /** Matches lost (does not include byes). */
  losses: number;
  /**
   * Effectiveness coefficient — sum across all finished matches of
   *   +(1 − P_loser / targetPoints)  for the winner of each match
   *   −(1 − P_loser / targetPoints)  for the loser of each match
   * Byes contribute 0 (neutral — no real opponent). Higher = stronger
   * margin of victory normalised by the target. Secondary sort.
   */
  effectivenessCoefficient: number;
  /**
   * Sum of points scored across finished matches. NO cap — winner score
   * counts raw because the closing hand can carry the score past the
   * target (e.g. 95 + 34 = 129 with target 100). Byes contribute 0.
   * Tertiary sort.
   */
  pointsScored: number;
  /** Sum of opponent points scored against this pair. Tracked for display. */
  pointsConceded: number;
  /** Direct head-to-head result against each opponent. Quaternary sort. */
  headToHeadResults: Map<string, 'win' | 'loss'>;
  hasHadBye: boolean;
  /** Round number of most recent bye, null if never had one. */
  lastByeRound: number | null;
  withdrawn: boolean;
}

// ─── Pairing output ────────────────────────────────────────────────────────────

export interface TablePairing {
  tableNumber: number;
  pairHomeId: string;
  pairAwayId: string;
}

export interface RoundPairingResult {
  pairings: TablePairing[];
  byePairId: string | null;
  warnings: string[];
}

// ─── Engine input ──────────────────────────────────────────────────────────────

export interface SwissPairingInput {
  pairs: Pair[];
  previousMatches: Match[];
  roundNumber: number;
  /** Per-tournament point goal — drives CE formula and score capping. */
  targetPoints: number;
}
