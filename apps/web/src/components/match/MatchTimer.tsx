"use client";

import { useMatchTimer } from "@/hooks/useMatchTimer";

type MatchTimerProps = {
  /** timer_started_at de la partida. null si el cronómetro aún no arrancó. */
  startedAt: string | null;
  /** time_limit_minutes de la partida. null si no tiene límite de tiempo. */
  timeLimitMinutes: number | null;
};

/**
 * Muestra el cronómetro de la partida en tiempo real.
 *
 * Estados visuales:
 * - No iniciado: "--:--" sin borde especial
 * - Corriendo (> 2 min): verde
 * - Warning (≤ 2 min): amarillo + pulse
 * - Expirado: rojo + "Tiempo terminado"
 *
 * Retorna null si no hay time_limit_minutes definido (no mostrar nada).
 */
export function MatchTimer({ startedAt, timeLimitMinutes }: MatchTimerProps) {
  const timer = useMatchTimer(startedAt, timeLimitMinutes);

  // No renderizar si no hay límite de tiempo configurado
  if (!timeLimitMinutes) return null;

  const borderClass = timer.isExpired
    ? "border-red-500/50"
    : timer.isWarning
    ? "border-yellow-500/50"
    : "border-border";

  const timeTextClass = timer.isExpired
    ? "text-red-400"
    : timer.isWarning
    ? "text-warning motion-safe:animate-pulse"
    : "text-text";

  // Anuncio "polite" SOLO para transiciones significativas (warning, expirado).
  // El tick de cada segundo se mantiene fuera de la región live para no
  // saturar al screen reader.
  const liveAnnouncement = timer.isExpired
    ? "El tiempo de la partida ha terminado"
    : timer.isWarning
    ? "Quedan menos de dos minutos"
    : "";

  return (
    <div
      className={`flex items-center justify-between bg-surface border rounded-lg px-4 py-3 mb-4 ${borderClass}`}
      role="timer"
      aria-label={`Tiempo restante: ${timer.mmss}`}
    >
      <div>
        <div className="text-text-mute text-xs uppercase tracking-wider mb-0.5">
          Tiempo
        </div>
        <div className={`text-3xl font-mono font-bold leading-none tabular-nums ${timeTextClass}`}>
          {timer.mmss}
        </div>
      </div>

      <div className="text-right">
        {timer.isExpired ? (
          <span className="text-red-400 text-sm font-bold">
            Tiempo terminado
          </span>
        ) : timer.isWarning ? (
          <span className="text-warning text-sm">
            Quedan menos de 2 min
          </span>
        ) : timer.state.kind === 'not_started' ? (
          <span className="text-text-mute text-sm">
            Sin iniciar
          </span>
        ) : (
          <span className="text-text-mute text-sm">
            {timeLimitMinutes} min
          </span>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </span>
    </div>
  );
}
