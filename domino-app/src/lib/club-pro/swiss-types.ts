import type { Database } from '@/types/supabase';

// ─── DB Row aliases ────────────────────────────────────────────────────────────

export type PairRow = Database['public']['Tables']['org_tournament_pairs']['Row'];
export type MatchRow = Database['public']['Tables']['org_tournament_matches']['Row'];

// ─── Engine input types ────────────────────────────────────────────────────────
//
// The engine works on lean projections of the DB rows to keep it
// dependency-free.  Callers (server actions in Phase 3) project from
// PairRow / MatchRow before calling the engine.

export interface Pair {
  id: string;
  initialSeed: number | null;
  withdrawnAt: string | null;
}

export interface Match {
  id: string;
  pairHomeId: string;
  /** null means this match IS the bye record (pair_away_id is NULL in DB) */
  pairAwayId: string | null;
  pairHomeScore: number | null;
  pairAwayScore: number | null;
  /** 'finished' | 'bye' are the only statuses that contribute to standings */
  status: 'pending' | 'in_progress' | 'finished' | 'bye';
  /**
   * Round number (1-indexed) this match belongs to.
   * Required so the engine can implement strict-rotation bye assignment:
   * when all active pairs have already received a bye, the pair whose
   * bye was the OLDEST (lowest roundNumber) receives the next one.
   * Phase-3 callers must project `org_tournament_rounds.round_number`
   * onto each Match before invoking the engine.
   */
  roundNumber: number;
}

// ─── Standings ─────────────────────────────────────────────────────────────────

export interface PairStanding {
  pairId: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  marginOfVictory: number;
  buchholz: number;
  /** map of opponentPairId → 'win' | 'draw' | 'loss' for head-to-head tiebreak */
  headToHeadResults: Map<string, 'win' | 'draw' | 'loss'>;
  hasHadBye: boolean;
  /**
   * Highest roundNumber where this pair received a bye, or null if never.
   * Drives the strict-rotation fallback in generateSwissPairings: when all
   * active pairs have had a bye, the next bye goes to the one with the
   * lowest lastByeRound (= oldest bye, most rounds since last rest).
   */
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

export type Tiebreaker = 'margin_of_victory' | 'buchholz' | 'head_to_head';

export interface SwissPairingInput {
  pairs: Pair[];
  previousMatches: Match[];
  roundNumber: number;
  tiebreaker: Tiebreaker;
}
