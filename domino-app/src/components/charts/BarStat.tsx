"use client";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  value: number;
  label: string;
  sublabel?: string;
  ariaLabel: string;
};

export function BarStat({ value, label, sublabel, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const clamp = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-mono font-bold tabular-nums">{clamp.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={reduced ? { width: `${clamp}%` } : { width: 0 }}
          animate={{ width: `${clamp}%` }}
          transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }}
        />
      </div>
      {sublabel && <div className="text-xs text-text-mute mt-1">{sublabel}</div>}
    </div>
  );
}
