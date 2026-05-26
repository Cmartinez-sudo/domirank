/**
 * Zod schema puro para user_preferences (sin dependencias de servidor).
 * Exportado aquí para que vitest pueda importarlo sin resolver
 * @/lib/supabase/server. Mismo patrón que tournament-schema.ts.
 */

import { z } from "zod";

export const userPreferencesInputSchema = z.object({
  default_match_modality: z.enum(['ven', 'dom', 'cub', 'pri']).nullable().optional(),
  skip_modality_prompt: z.boolean().optional(),
  notification_settings: z.record(z.unknown()).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
});

export type UserPreferencesInputSchema = z.infer<typeof userPreferencesInputSchema>;
