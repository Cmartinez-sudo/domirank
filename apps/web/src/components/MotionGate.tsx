"use client";

import { MotionConfig, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

/**
 * Root motion gate. Respects `prefers-reduced-motion` via `MotionConfig`,
 * but lets the user override the OS choice from Settings ("always" / "reduced").
 *
 * Spring defaults are DomiRank-flavored: enough character for celebratory
 * moments without cartoony overshoot on interactions.
 */
const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  damping: 22,
  stiffness: 320,
  mass: 0.9,
};

export function MotionGate({ children }: { children: ReactNode }) {
  const [pref] = useMotionPreference();
  const reducedMotion = pref === "reduced" ? "always" : pref === "always" ? "never" : "user";
  return (
    <MotionConfig reducedMotion={reducedMotion} transition={DEFAULT_TRANSITION}>
      {children}
    </MotionConfig>
  );
}
