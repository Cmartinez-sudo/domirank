export type ContinuousLeagueStandingsRow = {
  user_id:              string;
  username:             string;
  display_name:         string | null;
  avatar_url:           string | null;
  total_points:         number;
  points_for:           number;
  points_against:       number;
  diff:                 number;
  wins:                 number;
  losses:               number;
  win_pct:              number;
  games_played:         number;
  current_streak:       number;
  streak_type:          "W" | "L" | null;
  best_partner_id:      string | null;
  best_partner_name:    string | null;
  best_partner_wins:    number;
  best_partner_losses:  number;
  worst_rival_id:       string | null;
  worst_rival_name:     string | null;
  worst_rival_wins:     number;
  worst_rival_losses:   number;
};

/** Tab del leaderboard de polla continua. */
export type ContinuousLeagueDayFilter = "today" | "all";

export type ContinuousLeaguePartnerRow = {
  partner_id:     string;
  games_together: number;
  wins_together:  number;
  win_pct:        number; // always an integer (0–100)
};

export type ContinuousLeagueRivalRow = {
  rival_id:        string;
  games_against:   number;
  wins_for_rival:  number;
  win_pct:         number; // always an integer (0–100)
};

/** Modo de inscripción de un torneo. */
export type InscriptionMode = "pre_formed" | "individual_manual" | "continuous_league";

/** Fila de partida en la lista plana de la polla home. Reemplaza al viejo
 *  PollaMatchPreview / PollaRoundGroup del accordion. */
export type ContinuousLeagueMatchRow = {
  match_id:        string;
  status:          "in_progress" | "completed" | "confirmed" | "pending_attestation";
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  score_a:         number;
  score_b:         number;
  winner_team:     1 | 2 | null;
  created_at:      string;
};
