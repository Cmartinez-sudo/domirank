/**
 * Validación cross-field para el wizard de torneo (3 pasos).
 *
 * Función pura (sin dependencias de servidor) para que pueda usarse tanto
 * desde los step forms (validación inline) como desde el server action.
 *
 * F1.5 puede expandir esta función con casos adicionales o errores
 * estructurados; por ahora cubre los casos del spec de F1.4.
 */

import type { Format } from "@/hooks/useTournamentDraft";

export type ValidationErrors = {
  player_count?: string;
  num_boards?: string;
  format?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationErrors;
};

/**
 * Valida la combinación format + player_count + num_boards.
 * Las reglas vienen del spec F1.4 §Validación inline.
 */
export function validateTournamentConfig(config: {
  format: Format;
  player_count: number;
  num_boards: number;
}): ValidationResult {
  const errors: ValidationErrors = {};

  // Cap absoluto
  if (config.player_count > 64) {
    errors.player_count = "Máximo 64 jugadores por torneo.";
  } else if (config.player_count < 4) {
    errors.player_count = "Mínimo 4 jugadores.";
  } else {
    // Reglas por formato
    switch (config.format) {
      case "round_robin":
        if (config.player_count % 2 !== 0) {
          errors.player_count = `Round Robin de parejas requiere número par. Tienes ${config.player_count}, agrega o quita uno.`;
        }
        break;
      case "single_elim": {
        const validPow2 = [4, 8, 16, 32, 64];
        if (!validPow2.includes(config.player_count)) {
          errors.player_count = "Eliminación directa requiere 4, 8, 16, 32 o 64 jugadores.";
        }
        break;
      }
      case "continuous_league":
        // Sin restricción de paridad — puede ser cualquier número >= 4
        // (decisión Carlos 2026-05-31). El cap absoluto de 4..64 ya está
        // arriba.
        break;
      case "swiss":
        if (config.player_count < 4) {
          errors.player_count = "Suizo requiere al menos 4 jugadores.";
        }
        break;
    }
  }

  // Mesas físicas: 1..10 (UI), pero también sanity check vs partidas paralelas
  if (config.num_boards < 1 || config.num_boards > 10) {
    errors.num_boards = "Mesas entre 1 y 10.";
  } else if (config.player_count >= 4) {
    const matchesPerRound = Math.floor(config.player_count / 4);
    if (matchesPerRound > 0 && config.num_boards > matchesPerRound) {
      errors.num_boards = `Con ${config.player_count} jugadores, máximo ${matchesPerRound} mesa(s) tiene sentido.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Devuelve el día de la semana actual en español (lowercase, sin tilde).
 * Útil para el placeholder dinámico del nombre del torneo.
 */
export function diaDeSemanaEs(date: Date = new Date()): string {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return dias[date.getDay()];
}
