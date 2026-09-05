"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

/**
 * Burst de confeti cuando el viewer ES el ganador del día.
 *
 * Comportamiento:
 *  - Se dispara una sola vez por día por (tournament, user) usando
 *    localStorage con clave `domirank:king-confetti:{tournamentId}:{YYYY-MM-DD}`.
 *  - 100 partículas en 2 segundos. Colores DomiRank green + gold.
 *  - No bloqueante. No requiere dismiss. Pasa por encima de todo (z-index alto).
 *
 * Renderiza nada en el DOM — efecto puro en useEffect.
 */
type Props = {
  /** True si el viewer es el `is_day_winner` del día visible. */
  shouldFire: boolean;
  /** Tournament id (parte del flag de localStorage). */
  tournamentId: string;
  /** Session day YYYY-MM-DD (parte del flag — un confeti por día). */
  sessionDay: string;
};

export function DayWinnerConfetti({ shouldFire, tournamentId, sessionDay }: Props) {
  useEffect(() => {
    if (!shouldFire) return;
    if (typeof window === "undefined") return;

    const key = `domirank:king-confetti:${tournamentId}:${sessionDay}`;
    // Si ya se mostró hoy, no disparar.
    try {
      if (window.localStorage.getItem(key)) return;
    } catch {
      // localStorage puede fallar en modo privado — si pasa, simplemente
      // disparamos cada vez (mejor double-trigger que zero).
    }

    // Disparar 2 bursts pequeños desde los flancos para efecto "celebración".
    // Colores: verde DomiRank + dorado.
    const colors = ["#10b981", "#059669", "#facc15", "#f59e0b"];
    const duration = 1500;
    const end = Date.now() + duration;

    function frame() {
      if (Date.now() > end) return;
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      requestAnimationFrame(frame);
    }
    frame();

    // Marcar el flag para no repetir.
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, [shouldFire, tournamentId, sessionDay]);

  return null;
}
