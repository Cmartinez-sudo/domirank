"use client";
import type { FormChip } from "@/lib/profile-stats";
import { motion, useReducedMotion } from "framer-motion";

export function FormStrip({ chips, ariaLabel }: { chips: FormChip[]; ariaLabel: string }) {
  const reduced = useReducedMotion();
  if (chips.length === 0) {
    return <div className="text-text-mute text-sm" role="img" aria-label={ariaLabel}>Sin partidas recientes.</div>;
  }
  return (
    <div className="flex gap-1.5" role="img" aria-label={ariaLabel}>
      {chips.map((c, i) => (
        <motion.span
          key={i}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-mono font-bold text-sm ${c === "W" ? "bg-primary/20 text-primary" : "bg-danger/20 text-danger"}`}
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : i * 0.05 }}
        >
          {c === "W" ? "V" : "D"}
        </motion.span>
      ))}
    </div>
  );
}
