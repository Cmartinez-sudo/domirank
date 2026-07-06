/**
 * Schemas Zod puros para torneos (sin dependencias de servidor).
 * Exportados aquí para que vitest pueda importarlos sin que resuelva
 * @/lib/supabase/server (que no existe en el runtime de tests).
 *
 * Diseño del schema:
 *  - Combina campos del wizard nuevo (3 pasos, F1.4) y campos legacy del
 *    wizard viejo (9 pasos) para preservar compatibilidad con callers
 *    existentes y tests.
 *  - El wizard nuevo envía `player_count` + `participant_ids`. El server
 *    action `createTournament` deriva `max_players` e `inscription_mode`.
 *  - `inscription_mode` se preserva como input legacy (opcional) pero el
 *    wizard nuevo NO lo provee — se infiere del `format`.
 */

import { z } from "zod";

export const createTournamentSchema = z
  .object({
    name: z
      .string()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(60, "Máximo 60 caracteres"),
    /** 'public' es legacy del schema viejo; el wizard nuevo usa 'private' | 'code'. */
    visibility: z.enum(["public", "private", "code"]),
    format: z.enum(["single_elim", "round_robin", "swiss"]),
    modality: z.enum(["ven", "dom", "cub", "pri", "custom"]),
    custom_goal: z.number().int().min(50).max(500).optional(),
    custom_capicua: z.number().int().min(10).max(100).optional(),

    // ─── Cupo de jugadores ────────────────────────────────────────────────
    /** Cupo máximo (legacy). El wizard nuevo usa `player_count`. */
    max_players: z.number().int().min(4).max(64).optional(),
    /** Wizard nuevo: cantidad objetivo de jugadores. Se mapea a `max_players` en el server action. */
    player_count: z.number().int().min(4).max(64).optional(),

    // ─── Modo de inscripción ──────────────────────────────────────────────
    /** Legacy del wizard viejo. El wizard nuevo lo deriva del `format`. */
    inscription_mode: z
      .enum(["pre_formed", "individual_manual", "continuous_league"])
      .optional(),

    // ─── Participantes ────────────────────────────────────────────────────
    /** IDs de jugadores individuales a pre-inscribir. */
    participant_ids: z.array(z.string().uuid()).optional(),
    /** Parejas completas pre-formadas (legacy del wizard viejo). */
    pre_formed_pairs: z
      .array(
        z.object({
          user_a: z.string().uuid(),
          user_b: z.string().uuid(),
        }),
      )
      .optional(),

    time_limit_minutes: z.number().int().min(5).max(180).nullable(),

    /** Rondas planificadas (solo aplica a format='swiss'). 2..12. Null = motor decide. */
    rounds_count: z.number().int().min(2).max(12).nullable().optional(),

    /** Cantidad de mesas físicas disponibles en el torneo. Default 1. DB allow 1..16. */
    num_boards: z.number().int().min(1).max(16).default(1),
    description: z.string().max(500).optional(),
    join_code: z.string().length(6).optional(),
    /** Si las partidas afectan al rating Elo global. Default true. */
    rated: z.boolean().default(true),
    /** Si las partidas requieren attestation (3 de 4 firmas). Default true. F1.7 cablea finalizeMatch. */
    requires_attestation: z.boolean().default(true),
    /** Polla indefinida vs cerrada con N rondas (legacy del wizard viejo). */
    is_open_ended: z.boolean().default(false),
  })
  .refine((data) => data.max_players != null || data.player_count != null, {
    message: "Debe especificar player_count o max_players",
    path: ["player_count"],
  });

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

/** Puntos default por modalidad — fuente de verdad para el wizard y el server action. */
export const MODALITY_DEFAULT_POINTS: Record<string, number> = {
  ven: 100,
  dom: 200,
  cub: 200,
  pri: 200,
};

/**
 * Resuelve los puntos objetivo de la partida.
 *
 * Fase B: si `customGoal` está presente, gana sobre el default de modality.
 * Esto permite editar puntos sin tener que cambiar modality a 'custom'.
 * Fallback 100 si modality es desconocido.
 */
export function computePointsToWin(
  modality: string,
  customGoal: number | null | undefined,
): number {
  return customGoal ?? MODALITY_DEFAULT_POINTS[modality] ?? 100;
}
