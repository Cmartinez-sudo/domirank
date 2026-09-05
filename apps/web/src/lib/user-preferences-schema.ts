/**
 * Zod schema puro para user_preferences (sin dependencias de servidor).
 * Exportado aquí para que vitest pueda importarlo sin resolver
 * @/lib/supabase/server. Mismo patrón que tournament-schema.ts.
 */

import { z } from "zod";

export const userPreferencesInputSchema = z.object({
  /** @deprecated legacy; se acepta por compat pero prefiere los 4 campos nuevos. */
  default_match_modality: z.enum(['ven', 'dom', 'cub', 'pri']).nullable().optional(),
  default_count_rule: z.enum(['rival', 'mesa']).nullable().optional(),
  default_set_size: z.enum(['d6', 'd9']).nullable().optional(),
  default_target_points: z.number().int().min(50).max(500).nullable().optional(),
  default_capicua_bonus: z.number().int().min(0).max(100).nullable().optional(),
  skip_modality_prompt: z.boolean().optional(),
  notification_settings: z.record(z.unknown()).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

export type UserPreferencesInputSchema = z.infer<typeof userPreferencesInputSchema>;
