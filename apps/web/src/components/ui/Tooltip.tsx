"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  /** Tooltip position. Default: "top" */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Tooltip ligero sin dependencias externas.
 * En desktop: hover. En mobile: tap (cierra con tap fuera).
 */
export function Tooltip({ content, children, side = "top", className = "" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [visible]);

  const popoverClass =
    side === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-1/2 -translate-x-1/2";

  const arrowClass =
    side === "top"
      ? "absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
      : "absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0";

  const arrowStyle =
    side === "top"
      ? { borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid var(--color-border, rgba(255,255,255,.07))" }
      : { borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid var(--color-border, rgba(255,255,255,.07))" };

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible((v) => !v)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute ${popoverClass} z-50 whitespace-nowrap rounded-lg border border-border bg-surface shadow-pop px-2.5 py-1 text-xs text-text-dim pointer-events-none`}
        >
          {content}
          <span className={arrowClass} style={arrowStyle} />
        </span>
      )}
    </span>
  );
}
