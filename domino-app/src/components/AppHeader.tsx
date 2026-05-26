"use client";

import { useSafeBack } from "@/hooks/useSafeBack";

export interface AppHeaderProps {
  title?: string;
  fallbackPath: string;
  rightSlot?: React.ReactNode;
}

/**
 * Header universal para pantallas secundarias.
 * Provee botón "back" seguro (useSafeBack) y slot derecho opcional.
 * Reusar en todas las pages fuera del bottom nav raíz.
 */
export function AppHeader({ title, fallbackPath, rightSlot }: AppHeaderProps) {
  const { goBack } = useSafeBack(fallbackPath);

  return (
    <header
      className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-14 flex items-center gap-2">
          {/* Botón volver — hit area 44×44pt */}
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full
                       hover:bg-surface-2 active:bg-surface-3 transition-colors shrink-0
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* Título centrado */}
          {title && (
            <h1 className="flex-1 min-w-0 text-[16px] font-semibold truncate text-center -ml-9">
              {title}
            </h1>
          )}
          {!title && <div className="flex-1" />}

          {/* Slot derecho (acciones secundarias) */}
          <div className="shrink-0 flex items-center">
            {rightSlot ?? <div className="w-9" />}
          </div>
        </div>
      </div>
    </header>
  );
}
