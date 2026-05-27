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
