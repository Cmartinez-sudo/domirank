"use client";

import { useEffect, useRef } from "react";

/**
 * Focus trap accesible para modales. Cuando el modal está abierto:
 * - El tab queda atrapado dentro del contenedor
 * - Escape cierra el modal (vía onEscape callback)
 * - Al cerrar, devuelve el focus al elemento que abrió el modal
 *
 * Uso:
 *   const ref = useFocusTrap<HTMLDivElement>({ enabled: open, onEscape: close });
 *   return <div ref={ref}>...</div>
 */
export function useFocusTrap<T extends HTMLElement>(opts: {
  enabled: boolean;
  onEscape?: () => void;
}) {
  const ref = useRef<T | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!opts.enabled) return;
    const container = ref.current;
    if (!container) return;

    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    // Focus inicial: primer elemento focusable o el container
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        opts.onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusableElements(container!);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !container!.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restaurar focus al elemento que abrió el modal
      if (lastFocusedRef.current && document.body.contains(lastFocusedRef.current)) {
        lastFocusedRef.current.focus();
      }
    };
  }, [opts.enabled, opts.onEscape]);

  return ref;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null
  );
}
