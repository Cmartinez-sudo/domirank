"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UseSafeBackResult {
  goBack: () => void;
  fallbackPath: string;
}

/**
 * Hook para navegación "back" segura.
 * - Si hay historial del mismo origen, llama router.back().
 * - Si es deep-link sin historial o viene de otro origen, llama router.push(fallbackPath).
 * - Si `forceFallback` es true, siempre hace push (ignora historial) — útil
 *   cuando el historial contiene pasos intermedios (ej. /matches/new) y
 *   queremos saltarlos.
 * - SSR-safe: no toca document/window en el servidor.
 */
export function useSafeBack(
  fallbackPath: string,
  options?: { forceFallback?: boolean },
): UseSafeBackResult {
  const router = useRouter();
  const forceFallback = options?.forceFallback ?? false;

  const goBack = useCallback(() => {
    if (typeof window === "undefined" || forceFallback) {
      router.push(fallbackPath);
      return;
    }

    const referrer = document.referrer;
    if (referrer !== "") {
      try {
        const referrerOrigin = new URL(referrer).origin;
        if (referrerOrigin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // URL parse failed — treat as external
      }
    }

    router.push(fallbackPath);
  }, [router, fallbackPath, forceFallback]);

  return { goBack, fallbackPath };
}
