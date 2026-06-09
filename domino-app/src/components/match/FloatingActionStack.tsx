"use client";

import type { ReactNode } from "react";

/**
 * Bottom-right floating stack — Spec C8.
 *
 * Renders any provided children as a vertical pill stack (chip de partida
 * arriba, bug FAB abajo, etc.). The stack respects the safe area and
 * sits above the bottom-nav on mobile (which is z-30 typically).
 *
 * Z-index: 40 — below modals (50+), above page content.
 */
export function FloatingActionStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed right-3 z-40 flex flex-col items-end gap-2 pointer-events-none"
      style={{
        // Keep clear of bottom-nav (~64px) on mobile + safe-area inset.
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {children}
      </div>
    </div>
  );
}
