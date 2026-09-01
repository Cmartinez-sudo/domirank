"use client";
import type { HeatmapCell } from "@/lib/profile-stats";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type Props = {
  cells: HeatmapCell[];
  ariaLabel: string;
};

export function ActivityHeatmap({ cells, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<HeatmapCell | null>(null);

  const max = Math.max(1, ...cells.map(c => c.count));
  const intensity = (c: number) => {
    if (c === 0) return "bg-white/5";
    const ratio = c / max;
    if (ratio > 0.75) return "bg-primary";
    if (ratio > 0.5)  return "bg-primary/70";
    if (ratio > 0.25) return "bg-primary/45";
    return "bg-primary/25";
  };

  const cols: HeatmapCell[][] = [];
  for (let c = 0; c < 12; c++) cols.push(cells.slice(c * 7, c * 7 + 7));

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="grid grid-cols-12 gap-1">
        {cols.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-1">
            {col.map((cell, ri) => (
              <motion.button
                key={`${ci}-${ri}`}
                type="button"
                className={`aspect-square rounded-sm ${intensity(cell.count)}`}
                initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : (ci * 7 + ri) * 0.005 }}
                onFocus={() => setHover(cell)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(cell)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(cell)}
                aria-label={`${cell.day}: ${cell.count} partidas`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="text-xs text-text-mute mt-2 h-5">
        {hover ? `${hover.count} ${hover.count === 1 ? "partida" : "partidas"} · ${new Date(hover.day).toLocaleDateString("es", { day: "numeric", month: "short" })}` : "Últimas 12 semanas"}
      </div>
    </div>
  );
}
