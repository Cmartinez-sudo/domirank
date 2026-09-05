"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING, ShineSweep } from "@/components/Motion";
import { useCelebration } from "@/hooks/useCelebration";
import { TierBadge } from "@/components/RatingInfo";
import { tierFor } from "@/lib/rating";

type Props = {
  userId: string;
  display: number;
};

const KEY = (uid: string) => `domirank:last-tier:${uid}`;

/**
 * Wraps `TierBadge` and detects tier changes on the client. On the *first*
 * render where `tierFor(display).name` differs from the value stored in
 * `localStorage`, we fire a `tier-up` confetti burst and overlay a
 * "¡Nuevo tier!" pill for a few seconds.
 *
 * Client-only detection is fine because tier only changes after a rated
 * match, and users always land on a fresh render after that flow.
 */
export function TierUpCelebration({ userId, display }: Props) {
  const celebrate = useCelebration();
  const [showBanner, setShowBanner] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = tierFor(display).name;
    let prev: string | null = null;
    try {
      prev = window.localStorage.getItem(KEY(userId));
    } catch {
      // localStorage unavailable — skip celebration; not worth failing on.
    }

    if (prev && prev !== current) {
      setPrevious(prev);
      setShowBanner(true);
      celebrate("tier-up", { dedupeKey: `tier:${userId}:${prev}->${current}` });
      const t = setTimeout(() => setShowBanner(false), 3200);
      try {
        window.localStorage.setItem(KEY(userId), current);
      } catch {
        // ignore
      }
      return () => clearTimeout(t);
    }

    // First visit or no change — record current tier for future comparisons.
    try {
      if (!prev) window.localStorage.setItem(KEY(userId), current);
    } catch {
      // ignore
    }
  }, [display, userId, celebrate]);

  return (
    <span className="relative inline-flex items-center overflow-hidden rounded-full">
      <TierBadge display={display} size="md" />
      <AnimatePresence>
        {showBanner && (
          <>
            <ShineSweep duration={1.2} delay={0.15} />
            <motion.span
              key="banner"
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.9 }}
              transition={SPRING.celebratory}
              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-ink text-[10px] font-bold uppercase tracking-wider"
              role="status"
              aria-label={previous ? `Nuevo tier: subiste desde ${previous}` : "Nuevo tier alcanzado"}
            >
              ¡Nuevo tier!
            </motion.span>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}
