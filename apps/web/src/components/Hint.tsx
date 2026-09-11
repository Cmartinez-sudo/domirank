"use client";

// Sprint 1c: componente minimal de coach mark / first-time hint.
// Se auto-oculta si el `id` ya está en `initialSeenIds` (leído del server).
// Al cerrar (X o clic fuera) marca el id como visto vía server action.
// Nunca vuelve a aparecer para ese user + id.

import { useEffect, useRef, useState } from "react";
import { markHintSeen } from "@/lib/hints";
import { analytics } from "@/lib/analytics";

export type HintProps = {
  id: string;
  title?: string;
  body: string;
  /** IDs de hints ya vistos por el user (leídos server-side). */
  initialSeenIds: string[];
  /** Si false, no muestra nada. Sirve para gating por condiciones runtime. */
  when?: boolean;
  /** Elemento hijo al que se ancla el hint. */
  children: React.ReactNode;
  /** Timeout auto-close ms (default: nunca). */
  autoCloseMs?: number;
};

export function Hint({
  id,
  title,
  body,
  initialSeenIds,
  when = true,
  children,
  autoCloseMs,
}: HintProps) {
  const initiallyHidden = initialSeenIds.includes(id) || !when;
  const [hidden, setHidden] = useState(initiallyHidden);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hidden) {
      shownAtRef.current = Date.now();
      analytics.track("hint_shown", { hint_id: id });
      if (autoCloseMs) {
        const t = setTimeout(() => dismiss("auto"), autoCloseMs);
        return () => clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  function dismiss(reason: "user" | "auto") {
    if (hidden) return;
    const shown = shownAtRef.current;
    const ms = shown ? Date.now() - shown : 0;
    analytics.track("hint_dismissed", { hint_id: id, ms_visible: ms, reason });
    setHidden(true);
    // fire-and-forget al server
    markHintSeen(id).catch((e) => console.warn("[Hint] markHintSeen failed:", e));
  }

  if (initiallyHidden || hidden) return <>{children}</>;

  return (
    <div className="relative inline-flex flex-col items-stretch">
      {children}
      <div
        className="absolute top-full left-0 right-0 mt-2 z-30 bg-primary/95 text-white rounded-xl p-3 shadow-lg shadow-primary/30 max-w-xs animate-fade-in"
        role="dialog"
        aria-label={title ?? "Consejo"}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
            <div className="text-xs leading-relaxed">{body}</div>
          </div>
          <button
            type="button"
            aria-label="Cerrar consejo"
            className="text-white/80 hover:text-white text-lg leading-none"
            onClick={() => dismiss("user")}
          >
            ✕
          </button>
        </div>
        {/* Little arrow pointing up */}
        <div
          className="absolute -top-1.5 left-6 w-3 h-3 bg-primary/95 rotate-45"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
