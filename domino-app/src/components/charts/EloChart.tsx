"use client";

import { useMemo } from "react";
import { SKILL_TIERS, displayToElo } from "@/lib/rating";
import { LineAreaChart } from "./LineAreaChart";

export type EloChartPoint = {
  timestamp: number;
  elo: number;
  day: string;
};

type Props = {
  points: EloChartPoint[];
  showDots?: boolean;
  ariaLabel: string;
  height?: number;
};

const BRAND = "#10b981";
const PEAK = "#fbbf24";

/**
 * Elo evolution line/area with tier reference lines and peak marker.
 * Refactored on top of `LineAreaChart` — no more recharts. Same visual
 * contract as before (colors, dot behavior, peak marker); tooltip is
 * richer because ECharts handles the axis pointer natively.
 */
export function EloChart({ points, showDots = false, ariaLabel, height = 240 }: Props) {
  const data = useMemo(() => points.map((p) => ({ x: p.timestamp, y: p.elo })), [points]);

  const stats = useMemo(() => {
    if (points.length === 0) return { peak: null as EloChartPoint | null, minElo: 0, maxElo: 0, last: null as EloChartPoint | null };
    let maxE = points[0].elo;
    let minE = points[0].elo;
    let peakPoint = points[0];
    for (const p of points) {
      if (p.elo > maxE) { maxE = p.elo; peakPoint = p; }
      if (p.elo < minE) minE = p.elo;
    }
    return { peak: peakPoint, minElo: minE, maxElo: maxE, last: points[points.length - 1] };
  }, [points]);

  const markLines = useMemo(
    () =>
      SKILL_TIERS
        .map((t) => ({ y: Math.round(displayToElo(t.min)), label: t.name, color: t.color, opacity: 0.35 }))
        .filter((t) => t.y > stats.minElo && t.y < stats.maxElo),
    [stats.minElo, stats.maxElo],
  );

  const markPoints = useMemo(() => {
    const out: { x: number; y: number; color: string; label?: string; ring?: boolean }[] = [];
    if (stats.peak && stats.last && stats.peak.timestamp !== stats.last.timestamp) {
      out.push({ x: stats.peak.timestamp, y: stats.peak.elo, color: PEAK, label: `pico ${stats.peak.elo}`, ring: true });
    }
    if (stats.last) {
      out.push({ x: stats.last.timestamp, y: stats.last.elo, color: BRAND });
    }
    return out;
  }, [stats]);

  const deltaByIndex = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < points.length; i++) {
      arr.push(i === 0 ? null : points[i].elo - points[i - 1].elo);
    }
    return arr;
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="text-text-mute text-sm py-8 text-center" role="img" aria-label={ariaLabel}>
        Aún no hay suficientes partidas para dibujar la curva.
      </div>
    );
  }

  const pad = Math.max(15, Math.round((stats.maxElo - stats.minElo) * 0.15));
  const yDomain: [number, number] = [Math.max(1000, stats.minElo - pad), stats.maxElo + pad];

  return (
    <LineAreaChart
      data={data}
      color={BRAND}
      yDomain={yDomain}
      showDots={showDots}
      height={height}
      ariaLabel={ariaLabel}
      markLines={markLines}
      markPoints={markPoints}
      tooltipFormatter={({ xValue, yValue, index }) => {
        const date = new Date(xValue).toLocaleDateString("es", { day: "numeric", month: "short" });
        const delta = deltaByIndex[index];
        const deltaLine =
          delta == null
            ? ""
            : `<div style="font-family:ui-monospace,SFMono-Regular,monospace;margin-top:4px;color:${delta >= 0 ? "#10b981" : "#ef4444"}">
                 ${delta >= 0 ? "+" : ""}${delta} vs anterior
               </div>`;
        return `
          <div style="font-family:ui-monospace,SFMono-Regular,monospace;font-weight:700;font-size:13px">Elo ${yValue}</div>
          <div style="opacity:0.7;margin-top:2px">${date}</div>
          ${deltaLine}
        `;
      }}
    />
  );
}
