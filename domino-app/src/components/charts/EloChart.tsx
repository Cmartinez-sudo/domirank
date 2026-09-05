"use client";

import { useMemo } from "react";
import { SKILL_TIERS, toDisplayRating, tierFor } from "@/lib/rating";
import { LineAreaChart, type LineAreaChartXAxisTick } from "./LineAreaChart";

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
const DISPLAY_MIN = 1;
const DISPLAY_MAX = 20;

/**
 * DomiRank evolution over time. Data comes in as raw Elo (the internal
 * scale) but we graph the user-facing 1–20 DomiRank display because that's
 * the number people recognize as "their rating" everywhere else in the app.
 *
 * Reference lines highlight tier thresholds; the tier the user is *in right
 * now* is drawn solid + bold ("Estás en X"), the rest are dashed and faded.
 * Peak is shown as a filled pill ("Tu mejor: 12.4") and the current point
 * gets a subtle pulse so "you are here" reads immediately.
 */
export function EloChart({ points, showDots = false, ariaLabel, height = 260 }: Props) {
  // Map raw Elo to DomiRank display (1.0–20.0) — this is what we chart.
  const displayPoints = useMemo(
    () => points.map((p) => ({ ...p, display: toDisplayRating(p.elo) })),
    [points],
  );

  const data = useMemo(
    () => displayPoints.map((p) => ({ x: p.timestamp, y: p.display })),
    [displayPoints],
  );

  const stats = useMemo(() => {
    if (displayPoints.length === 0) {
      return { peak: null, minDisplay: 0, maxDisplay: 0, last: null };
    }
    let maxD = displayPoints[0].display;
    let minD = displayPoints[0].display;
    let peakPoint = displayPoints[0];
    for (const p of displayPoints) {
      if (p.display > maxD) { maxD = p.display; peakPoint = p; }
      if (p.display < minD) minD = p.display;
    }
    return {
      peak: peakPoint,
      minDisplay: minD,
      maxDisplay: maxD,
      last: displayPoints[displayPoints.length - 1],
    };
  }, [displayPoints]);

  // Current tier — the one the user is in right now.
  const currentTier = useMemo(
    () => (stats.last ? tierFor(stats.last.display) : null),
    [stats.last],
  );

  const markLines = useMemo(() => {
    // Show every tier threshold that falls inside the visible Y range so the
    // user can see how close they are to leveling up or how far they've come.
    const visibleRangeMin = Math.max(DISPLAY_MIN, stats.minDisplay - 2);
    const visibleRangeMax = Math.min(DISPLAY_MAX, stats.maxDisplay + 2);
    return SKILL_TIERS
      .filter((t) => t.min > visibleRangeMin && t.min < visibleRangeMax)
      .map((t) => {
        const isCurrent = currentTier?.name === t.name;
        return {
          y: t.min,
          label: isCurrent ? `Estás en ${t.name}` : t.name,
          color: t.color,
          highlight: isCurrent,
        };
      });
  }, [stats.minDisplay, stats.maxDisplay, currentTier]);

  const markPoints = useMemo(() => {
    const out: { x: number; y: number; color: string; label?: string; ring?: boolean; pill?: boolean }[] = [];
    if (stats.peak && stats.last && stats.peak.timestamp !== stats.last.timestamp) {
      out.push({
        x: stats.peak.timestamp,
        y: stats.peak.display,
        color: PEAK,
        label: `Tu mejor: ${stats.peak.display.toFixed(1)}`,
        pill: true,
      });
    }
    return out;
  }, [stats]);

  // Elo deltas keep the tooltip informative for power users while the primary
  // display value is the DomiRank number.
  const deltaByIndex = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < displayPoints.length; i++) {
      arr.push(i === 0 ? null : Number((displayPoints[i].display - displayPoints[i - 1].display).toFixed(1)));
    }
    return arr;
  }, [displayPoints]);

  // Dynamic X axis: pick 3–4 ticks and format by the total time range so labels
  // stay short at every zoom level.
  const xAxisTicks = useMemo<LineAreaChartXAxisTick[]>(() => {
    if (displayPoints.length < 2) return [];
    const first = displayPoints[0].timestamp;
    const last = displayPoints[displayPoints.length - 1].timestamp;
    const rangeMs = last - first;
    const rangeDays = rangeMs / 86_400_000;
    const formatter = pickDateFormatter(rangeDays);
    const count = 4;
    const ticks: LineAreaChartXAxisTick[] = [];
    for (let i = 0; i < count; i++) {
      const t = first + (rangeMs * i) / (count - 1);
      const isLast = i === count - 1;
      ticks.push({ x: t, label: isLast ? "hoy" : formatter(new Date(t)) });
    }
    return ticks;
  }, [displayPoints]);

  if (displayPoints.length < 2) {
    return (
      <div className="text-text-mute text-sm py-8 text-center" role="img" aria-label={ariaLabel}>
        Aún no hay suficientes partidas para dibujar tu curva.
      </div>
    );
  }

  // Y domain: expand a bit so tier labels floating above lines don't collide
  // with the top of the plot, and so the user's line has breathing room.
  const pad = Math.max(0.6, (stats.maxDisplay - stats.minDisplay) * 0.15);
  const yDomain: [number, number] = [
    Math.max(DISPLAY_MIN, Math.floor(stats.minDisplay - pad)),
    Math.min(DISPLAY_MAX, Math.ceil(stats.maxDisplay + pad)),
  ];

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
      markLineLabelPosition="insideStartTop"
      xAxisTicks={xAxisTicks}
      currentPoint={stats.last ? { x: stats.last.timestamp, y: stats.last.display, color: BRAND } : undefined}
      leftPadding={36}
      rightPadding={12}
      tooltipFormatter={({ xValue, yValue, index }) => {
        const date = new Date(xValue).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
        const delta = deltaByIndex[index];
        const tier = tierFor(yValue).name;
        const deltaLine =
          delta == null || delta === 0
            ? ""
            : `<div style="font-family:ui-monospace,SFMono-Regular,monospace;margin-top:4px;color:${delta > 0 ? "#10b981" : "#ef4444"}">
                 ${delta > 0 ? "+" : ""}${delta.toFixed(1)} vs anterior
               </div>`;
        return `
          <div style="font-family:ui-monospace,SFMono-Regular,monospace;font-weight:700;font-size:14px">DomiRank ${yValue.toFixed(1)}</div>
          <div style="opacity:0.7;margin-top:2px;font-size:11px">${tier} · ${date}</div>
          ${deltaLine}
        `;
      }}
    />
  );
}

function pickDateFormatter(rangeDays: number): (d: Date) => string {
  if (rangeDays < 90) {
    // e.g. "3 mar"
    return (d) => d.toLocaleDateString("es", { day: "numeric", month: "short" });
  }
  if (rangeDays < 365) {
    // e.g. "mar" — month short
    return (d) => d.toLocaleDateString("es", { month: "short" });
  }
  // e.g. "mar 25"
  return (d) => {
    const parts = d.toLocaleDateString("es", { month: "short", year: "2-digit" });
    return parts.replace(" de ", " ").trim();
  };
}
