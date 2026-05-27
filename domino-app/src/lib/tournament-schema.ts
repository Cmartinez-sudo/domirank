/**
 * Schemas Zod puros para torneos (sin dependencias de servidor).
 * Exportados aquí para que vitest pueda importarlos sin que resuelva
 * @/lib/supabase/server (que no existe en el runtime de tests).
 */

import { z } from "zod";

export const createTournamentSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(60, "Máximo 60 caracteres"),
  visibility: z.enum(["public", "private", "code"]),
  format: z.enum(["single_elim", "round_robin", "swiss", "polla"]),
  modality: z.enum(["ven", "dom", "cub", "pri", "custom"]),
  custom_goal: z.number().int().min(50).max(500).optional(),
  custom_capicua: z.number().int().min(10).max(100).optional(),
  max_players: z.number().int().min(4).max(64),
  inscription_mode: z.enum(["pre_formed", "individual_manual", "polla"]),
  /** IDs de jugadores individuales a pre-inscribir */
  participant_ids: z.array(z.string().uuid()).optional(),
  /** Parejas completas pre-formadas */
  pre_formed_pairs: z
    .array(
      z.object({
        user_a: z.string().uuid(),
        user_b: z.string().uuid(),
      }),
    )
    .optional(),
  time_limit_minutes: z.number().int().min(5).max(180).nullable(),
  /** Cantidad de mesas físicas disponibles en el torneo (R-boards). Default 1. */
  num_boards: z.number().int().min(1).max(16).default(1),
  description: z.string().max(500).optional(),
  join_code: z.string().length(6).optional(),
  /** Si las partidas de este torneo afectan al rating global (Elo). Default true. */
  rated: z.boolean().default(true),
  /** Si la polla es indefinida (true) o cerrada con N rondas (false). */
  is_open_ended: z.boolean().default(false),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
