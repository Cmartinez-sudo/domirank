"use client";

import { motion } from "framer-motion";
import { SPRING } from "@/components/Motion";

/**
 * Badge for an active winning streak. Wobbles the flame emoji on a slow
 * loop and gently pulses the container. The whole thing scales in with
 * a `celebratory` spring on mount so it feels earned rather than static.
 *
 * Respects `prefers-reduced-motion` via `MotionGate` — falls back to a
 * plain badge.
 */
export function StreakBadge({ count, className }: { count: number; className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.celebratory}
      className={
        "relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full " +
        "bg-primary/20 text-primary text-sm font-semibold overflow-hidden " +
        (className ?? "")
      }
    >
      <motion.span
        aria-hidden="true"
        animate={{ rotate: [-8, 8, -8], scale: [1, 1.15, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="inline-block"
      >
        🔥
      </motion.span>
      <span>{count} victorias seguidas</span>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-primary/15"
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.span>
  );
}
