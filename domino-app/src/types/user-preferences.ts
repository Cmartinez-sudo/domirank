export type UserPreferences = {
  user_id: string;
  default_match_modality: 'ven' | 'dom' | 'cub' | 'pri' | null;
  skip_modality_prompt: boolean;
  notification_settings: Record<string, unknown>;
  theme: 'dark' | 'light' | 'system';
  created_at: string;
  updated_at: string;
};

export type UserPreferencesInput = Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>;
