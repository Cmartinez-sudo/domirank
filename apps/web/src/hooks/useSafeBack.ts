"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseSafeBackResult {
  goBack: () => void;
  fallbackPath: string;
}

/**
 * Hook para navegación "up-back" — la flecha atrás va SIEMPRE al parent
 * lógico declarado en `fallbackPath`, NO al screen previo del historial.
 *
 * Modelo: up-navigation (iOS/Android nativo). Coherente con la jerarquía
 * del app, independiente de cómo llegaste (deep-link, notificación, tap
 * en dashboard, etc.). Cada page/AppHeader declara su parent lógico.
 *
 * Ejemplos:
 * - /tournaments/[id]         → /tournaments
 * - /matches/[id] (torneo)    → /tournaments/[tournamentId]
 * - /matches/[id] (casual)    → /dashboard
 * - /profile/[username] (yo)  → /dashboard
 * - /profile/[username] (otro)→ /leaderboard
 * - /tournaments/new/step-2   → /tournaments/new/step-1
 *
 * Motivación: el modelo "history" (router.back()) es impredecible — venir
 * a un torneo desde el dashboard y tocar la flecha te devolvía al home,
 * no a la lista de torneos. Con up-nav, la flecha siempre significa "un
 * nivel arriba en la jerarquía del app".
 *
 * SSR-safe: no toca document/window.
 *
 * @param fallbackPath - Parent lógico de la page actual.
 * @param options.forceFallback - Deprecated no-op. El default ya es
 *   up-nav; esta opción existía para el modelo antiguo y se mantiene por
 *   compat, pero no cambia comportamiento.
 */
export function useSafeBack(
  fallbackPath: string,
  _options?: { forceFallback?: boolean },
): UseSafeBackResult {
  const router = useRouter();

  const goBack = useCallback(() => {
    router.push(fallbackPath);
  }, [router, fallbackPath]);

  return { goBack, fallbackPath };
}
