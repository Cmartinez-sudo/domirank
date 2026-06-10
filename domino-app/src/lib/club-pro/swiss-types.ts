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
