"use client";

import { useCallback, useRef } from "react";

/**
 * Celebration presets — canvas-confetti configs tuned for DomiRank moments.
 * Colors match the brand tokens (emerald + gold) and stay identical across
 * light and dark themes so the celebration reads the same to everyone.
 */
export type CelebrationVariant = "win-rated" | "tier-up" | "streak" | "small-burst";

const COLORS = ["#10b981", "#059669", "#facc15", "#f59e0b"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function readMotionOverride(): "reduced" | "always" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem("domirank-motion");
  return v === "reduced" || v === "always" ? v : null;
}

function shouldFire(): boolean {
  const override = readMotionOverride();
  if (override === "reduced") return false;
  if (override === "always") return true;
  return !prefersReducedMotion();
}

/**
 * Fires a celebration burst using `canvas-confetti`. Import is dynamic
 * so the ~10kb library only lands on the client bundle for pages that
 * actually celebrate. Dedupes concurrent calls to the same key.
 */
export function useCelebration() {
  const firedKeys = useRef<Set<string>>(new Set());

  return useCallback(async (variant: CelebrationVariant, opts?: { dedupeKey?: string }) => {
    if (!shouldFire()) return;
    if (opts?.dedupeKey) {
      if (firedKeys.current.has(opts.dedupeKey)) return;
      firedKeys.current.add(opts.dedupeKey);
    }

    const confetti = (await import("canvas-confetti")).default;

    switch (variant) {
      case "win-rated": {
        // Two side bursts over ~1.6s — bigger than day-winner, less than tournament.
        const end = Date.now() + 1600;
        const step = () => {
          if (Date.now() > end) return;
          confetti({ particleCount: 12, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors: COLORS, zIndex: 9999 });
          confetti({ particleCount: 12, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors: COLORS, zIndex: 9999 });
          requestAnimationFrame(step);
        };
        step();
        return;
      }
      case "tier-up": {
        // One centered burst — the badge itself already draws the eye.
        confetti({
          particleCount: 90,
          spread: 90,
          startVelocity: 38,
          origin: { x: 0.5, y: 0.4 },
          colors: COLORS,
          zIndex: 9999,
          ticks: 200,
        });
        return;
      }
      case "streak": {
        // Tiny gold burst — the streak badge is the star, confetti is a wink.
        confetti({
          particleCount: 24,
          spread: 55,
          startVelocity: 28,
          origin: { x: 0.5, y: 0.35 },
          colors: ["#facc15", "#f59e0b", "#fbbf24"],
          zIndex: 9999,
          ticks: 140,
        });
        return;
      }
      case "small-burst": {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { x: 0.5, y: 0.5 },
          colors: COLORS,
          zIndex: 9999,
        });
        return;
      }
    }
  }, []);
}
