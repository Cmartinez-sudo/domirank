"use client";
import { useMemo, useState } from "react";
import type { HeatmapCell } from "@/lib/profile-stats";
import { HeatmapChart, type HeatmapPoint } from "./HeatmapChart";

type Props = {
  cells: HeatmapCell[];
  ariaLabel: string;
};

const PRIMARY = "#10b981";

/**
 * 12 weeks × 7 days activity heatmap. Refactored on top of `HeatmapChart`
 * (ECharts). Same shape as before; now with native tooltips per cell and
 * proper visualMap for the color gradient.
 */
export function ActivityHeatmap({ cells, ariaLabel }: Props) {
  const [hover, setHover] = useState<HeatmapPoint | null>(null);

  const data = useMemo<HeatmapPoint[]>(
    () =>
      cells.map((cell, i) => ({
        col: Math.floor(i / 7),
        row: i % 7,
        value: cell.count,
        label: cell.day,
      })),
    [cells],
  );

  return (
    <div>
      <HeatmapChart
        data={data}
        cols={12}
        rows={7}
        color={PRIMARY}
        height={160}
        ariaLabel={ariaLabel}
        tooltipFormatter={(p) => {
          const date = new Date(p.label ?? "").toLocaleDateString("es", { day: "numeric", month: "short" });
          const plural = p.value === 1 ? "partida" : "partidas";
          return `<div style="font-weight:600">${p.value} ${plural}</div><div style="opacity:0.7;margin-top:2px">${date}</div>`;
        }}
        onHover={setHover}
      />
      <div className="text-xs text-text-mute mt-2 h-5">
        {hover
          ? `${hover.value} ${hover.value === 1 ? "partida" : "partidas"} · ${new Date(hover.label ?? "").toLocaleDateString("es", { day: "numeric", month: "short" })}`
          : "Últimas 12 semanas"}
      </div>
    </div>
  );
}
