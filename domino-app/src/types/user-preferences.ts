export type UserPreferences = {
  user_id: string;
  /** @deprecated Se conserva por compat de lectura. Preferir default_count_rule + los 3 defaults nuevos. */
  default_match_modality: 'ven' | 'dom' | 'cub' | 'pri' | null;
  /** Regla de conteo por defecto del usuario (identidad de la "modalidad"). */
  default_count_rule: 'rival' | 'mesa' | null;
  /** Set default. Post-retiro d9, siempre 'd6' en valores nuevos; nullable por retrocompat. */
  default_set_size: 'd6' | 'd9' | null;
  /** Meta de tantos default (50-500). */
  default_target_points: number | null;
  /** Bonus capicúa default (0-100). */
  default_capicua_bonus: number | null;
  skip_modality_prompt: boolean;
  notification_settings: Record<string, unknown>;
  theme: 'dark' | 'light' | 'system';
  created_at: string;
  updated_at: string;
};

export type UserPreferencesInput = Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>;
