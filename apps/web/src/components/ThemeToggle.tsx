"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  className?: string;
};

/**
 * Sun/moon toggle. Renders neutral markup until mounted so SSR and the
 * first hydration match — otherwise React yells because the resolvedTheme
 * is only available on the client.
 *
 * Motion respects `prefers-reduced-motion` via the root MotionGate.
 */
export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";
  const next = isLight ? "dark" : "light";
  const label = isLight ? "Activar tema oscuro" : "Activar tema claro";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={label}
      onClick={() => setTheme(next)}
      className={
        "relative inline-flex items-center justify-center w-11 h-11 rounded-full " +
        "bg-surface-2 border border-border text-text " +
        "hover:bg-surface-3 active:scale-95 transition-colors " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
        (className ?? "")
      }
    >
      <AnimatePresence initial={false} mode="wait">
        {isLight ? (
          <motion.span
            key="moon"
            initial={{ rotate: -60, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 60, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="inline-flex"
            aria-hidden="true"
          >
            <MoonIcon />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 60, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -60, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="inline-flex"
            aria-hidden="true"
          >
            <SunIcon />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
