// Tipos para el leaderboard de torneos v2

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
  win_pct: number;
  pf: number;
  pc: number;
  plus_minus: number;
  /** Ejemplo: "3W" | "1L" | "0W" */
  streak: string;
  /** Hasta 5 elementos: "W" | "L", orden más viejo → más reciente */
  last5: string[];
  /** Rank en el snapshot anterior. Null si no hay snapshot previo. */
  prev_rank: number | null;
}

export type SortKey = "rank" | "wins" | "losses" | "win_pct" | "pf" | "pc" | "plus_minus";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface LeaderboardProps {
  tournamentId: string;
  initialStandings: LeaderboardRow[];
  viewerId: string | null;
  isOrganizer: boolean;
}
