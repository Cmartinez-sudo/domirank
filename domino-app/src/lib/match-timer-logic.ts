/**
 * match-timer-logic.ts
 *
 * Lógica pura del cronómetro de partidas — sin dependencias de React.
 * Extraído para testabilidad independiente del hook useMatchTimer.
 *
 * Importar con ruta relativa en tests: import { ... } from './match-timer-logic'
 */

export type TimerState =
  | { kind: 'not_started' }
  | { kind: 'running'; secondsLeft: number; warning: boolean }
  | { kind: 'expired' };

/** Umbral de warning: menos de 2 minutos = 120 segundos. */
export const WARNING_THRESHOLD_SECONDS = 120;

/**
 * Calcula el estado del timer dado un instante concreto (nowMs).
 *
 * @param startedAtIso  - ISO string del timestamp de inicio del timer
 * @param timeLimitMinutes - duración en minutos
 * @param nowMs - momento actual en milisegundos (inyectado para testabilidad)
 * @returns TimerState
 */
export function computeTimerState(
  startedAtIso: string | null,
  timeLimitMinutes: number | null,
  nowMs: number,
): TimerState {
  if (!startedAtIso || !timeLimitMinutes) {
    return { kind: 'not_started' };
  }

  const startMs = new Date(startedAtIso).getTime();
  const endMs = startMs + timeLimitMinutes * 60 * 1000;
  const remainingMs = endMs - nowMs;

  if (remainingMs <= 0) {
    return { kind: 'expired' };
  }

  const secondsLeft = Math.ceil(remainingMs / 1000);
  return {
    kind: 'running',
    secondsLeft,
    warning: secondsLeft <= WARNING_THRESHOLD_SECONDS,
  };
}

/**
 * Formatea segundos en formato mm:ss.
 * Ejemplos: 90 → "1:30", 5 → "0:05", 3600 → "60:00"
 */
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

/**
 * Dado el estado del timer, devuelve el string visible en el UI.
 * - not_started → "--:--"
 * - running → "mm:ss"
 * - expired → "0:00"
 */
export function timerDisplayString(state: TimerState): string {
  if (state.kind === 'not_started') return '--:--';
  if (state.kind === 'expired') return '0:00';
  return formatMmSs(state.secondsLeft);
}
