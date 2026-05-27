export type PollaStandingsRow = {
  user_id:           string;
  username:          string;
  display_name:      string | null;
  avatar_url:        string | null;
  total_points:      number;
  wins:              number;
  losses:            number;
  win_pct:           number;
  games_played:      number;
  current_streak:    string;
  best_partner_id:   string | null;
  best_partner_name: string | null;
  worst_rival_id:    string | null;
  worst_rival_name:  string | null;
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

/** Una partida tal como la muestra el accordion de la polla. */
export type PollaMatchPreview = {
  match_id:        string;
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  team_a_score:    number;
  team_b_score:    number;
  status:          "pending" | "confirmed" | "in_progress";
};

/** Grupo de partidas agrupado como "ronda" (cada N partidas en orden
 *  cronológico, N = players/2). El número de ronda es visual, no impone
 *  constraint sobre los pairings. */
export type PollaRoundGroup = {
  round_number: number;
  matches:      PollaMatchPreview[];
};
