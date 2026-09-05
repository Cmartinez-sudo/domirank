"use client";

import { useEffect, useRef } from "react";

/**
 * Hook compartido para a11y de modales:
 * - Focus trap (Tab/Shift+Tab queda dentro del dialog)
 * - Escape key cierra el modal
 * - Auto-focus en el primer elemento focuseable cuando se monta
 *
 * Uso:
 *   const dialogRef = useModalA11y({ onClose });
 *   <div ref={dialogRef} role="dialog" ...>...</div>
 */
export function useModalA11y({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const FOCUSABLE_SELECTOR =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = (): HTMLElement[] =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Auto-focus first focusable on mount
    const focusables = getFocusables();
    focusables[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return dialogRef;
}
