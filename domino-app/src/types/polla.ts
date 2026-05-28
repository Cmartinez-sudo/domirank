export type PollaStandingsRow = {
  user_id:              string;
  username:             string;
  display_name:         string | null;
  avatar_url:           string | null;
  total_points:         number;
  wins:                 number;
  losses:               number;
  win_pct:              number;
  games_played:         number;
  current_streak:       string;
  best_partner_id:      string | null;
  best_partner_name:    string | null;
  best_partner_wins:    number;
  best_partner_losses:  number;
  worst_rival_id:       string | null;
  worst_rival_name:     string | null;
  worst_rival_wins:     number;
  worst_rival_losses:   number;
};

export type PollaPartnerRow = {
  partner_id:     string;
  games_together: number;
  wins_together:  number;
  win_pct:        number; // always an integer (0–100)
};

export type PollaRivalRow = {
  rival_id:        string;
  games_against:   number;
  wins_for_rival:  number;
  win_pct:         number; // always an integer (0–100)
};

/** Modo de inscripción de un torneo. */
export type InscriptionMode = "pre_formed" | "individual_manual" | "polla";

/** Fila de partida en la lista plana de la polla home. Reemplaza al viejo
 *  PollaMatchPreview / PollaRoundGroup del accordion. */
export type PollaMatchRow = {
  match_id:        string;
  status:          "in_progress" | "completed" | "confirmed" | "pending_attestation";
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  score_a:         number;
  score_b:         number;
  winner_team:     1 | 2 | null;
  created_at:      string;
};
