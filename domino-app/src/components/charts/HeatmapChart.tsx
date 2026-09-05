"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";

export type HeatmapPoint = {
  col: number;
  row: number;
  value: number;
  label?: string;
};

type Props = {
  data: HeatmapPoint[];
  cols: number;
  rows: number;
  maxValue?: number;
  color: string;
  height?: number;
  ariaLabel: string;
  tooltipFormatter?: (p: HeatmapPoint) => string;
  /** Callback when a cell is hovered — receives the point or `null`. */
  onHover?: (p: HeatmapPoint | null) => void;
};

/**
 * Discrete heatmap grid, oriented `cols × rows` (e.g. 12 weeks × 7 days).
 * Passes native ECharts tooltips through so hovers get rich labels for
 * free — one of the wins from swapping the DIV-grid implementation.
 */
export function HeatmapChart({
  data,
  cols,
  rows,
  maxValue,
  color,
  height = 180,
  ariaLabel,
  tooltipFormatter,
  onHover,
}: Props) {
  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value));
  const option = useMemo<EChartsOption>(() => {
    const cellData = data.map((d) => [d.col, d.row, d.value, d.label ?? ""]);
    return {
      grid: { top: 4, right: 4, bottom: 4, left: 4, containLabel: false },
      tooltip: {
        trigger: "item",
        formatter: tooltipFormatter
          ? (params: unknown) => {
              const p = params as { data: [number, number, number, string] };
              const [col, row, value, label] = p.data;
              return tooltipFormatter({ col, row, value, label });
            }
          : (params: unknown) => {
              const p = params as { data: [number, number, number, string] };
              const [, , value, label] = p.data;
              return `${value} · ${label}`;
            },
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: cols }, (_, i) => String(i)),
        show: false,
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: Array.from({ length: rows }, (_, i) => String(i)),
        show: false,
        splitArea: { show: false },
        inverse: true,
      },
      visualMap: {
        show: false,
        min: 0,
        max,
        inRange: {
          color: [hexWithAlpha(color, 0.08), hexWithAlpha(color, 0.35), hexWithAlpha(color, 0.7), color],
        },
      },
      series: [
        {
          type: "heatmap",
          data: cellData,
          itemStyle: { borderRadius: 2, borderWidth: 1, borderColor: "transparent" },
          emphasis: { itemStyle: { borderColor: color, borderWidth: 1 } },
          progressive: 0,
          animationDuration: 300,
        },
      ],
    };
  }, [data, cols, rows, max, color, tooltipFormatter]);

  return (
    <Chart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      onReady={(instance) => {
        if (!onHover) return undefined;
        const handler = (params: unknown) => {
          const p = params as { data: [number, number, number, string] };
          const [col, row, value, label] = p.data;
          onHover({ col, row, value, label });
        };
        const leave = () => onHover(null);
        instance.on("mouseover", "series", handler);
        instance.on("mouseout", "series", leave);
        return () => {
          instance.off("mouseover", handler);
          instance.off("mouseout", leave);
        };
      }}
    />
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#")) return hex;
  const clean = hex.slice(1);
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
