"use client";

import { useEffect, useState } from "react";
import {
  computeTimerState,
  timerDisplayString,
  type TimerState,
} from "@/lib/match-timer-logic";

export type UseMatchTimerResult = {
  /** Segundos restantes. null si el timer no arrancó todavía. */
  secondsLeft: number | null;
  /** true cuando el tiempo llegó a 0. */
  isExpired: boolean;
  /** true si quedan ≤ 2 minutos (120 s) — para mostrar warning visual. */
  isWarning: boolean;
  /** String formateado "mm:ss" listo para mostrar. "--:--" si no arrancó. */
  mmss: string;
  /** Estado del timer en detalle. */
  state: TimerState;
};

/**
 * Hook reactivo del cronómetro de partidas.
 *
 * Re-renderiza cada segundo con `setInterval`. Limpia el intervalo al desmontar
 * o cuando cambian las props.
 *
 * @param startedAt  - ISO string del timer_started_at de la partida (null si no arrancó)
 * @param timeLimitMinutes - time_limit_minutes de la partida (null si no tiene límite)
 */
export function useMatchTimer(
  startedAt: string | null,
  timeLimitMinutes: number | null,
): UseMatchTimerResult {
  const [state, setState] = useState<TimerState>(() =>
    computeTimerState(startedAt, timeLimitMinutes, Date.now())
  );

  useEffect(() => {
    // Si no hay timer configurado, forzar not_started y no instalar interval
    if (!startedAt || !timeLimitMinutes) {
      setState({ kind: 'not_started' });
      return;
    }

    // Tick inmediato para inicializar sin esperar 1 segundo
    const tick = () => {
      setState(computeTimerState(startedAt, timeLimitMinutes, Date.now()));
    };
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes]);

  return {
    secondsLeft: state.kind === 'running' ? state.secondsLeft : state.kind === 'expired' ? 0 : null,
    isExpired: state.kind === 'expired',
    isWarning: state.kind === 'running' ? state.warning : false,
    mmss: timerDisplayString(state),
    state,
  };
}
