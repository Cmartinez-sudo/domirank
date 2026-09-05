"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";

export type LinePoint = { x: number; y: number };

export type LineAreaChartMarkLine = {
  y: number;
  label: string;
  color: string;
  opacity?: number;
};

export type LineAreaChartMarkPoint = {
  x: number;
  y: number;
  color: string;
  label?: string;
  ring?: boolean;
};

type Props = {
  data: LinePoint[];
  color: string;
  fillGradientAlpha?: number;
  markLines?: LineAreaChartMarkLine[];
  markPoints?: LineAreaChartMarkPoint[];
  yDomain?: [number, number];
  showDots?: boolean;
  height?: number;
  ariaLabel: string;
  tooltipFormatter?: (params: { xValue: number; yValue: number; index: number }) => string;
};

/**
 * Themed line-area chart wrapper. Callers pass their data in domain terms
 * (x/y numbers, tier reference lines, peak markers) and this file constructs
 * the ECharts option. Kept intentionally narrow — extend props only when
 * a real chart needs it, not preemptively.
 */
export function LineAreaChart({
  data,
  color,
  fillGradientAlpha = 0.35,
  markLines = [],
  markPoints = [],
  yDomain,
  showDots = false,
  height = 240,
  ariaLabel,
  tooltipFormatter,
}: Props) {
  const option = useMemo<EChartsOption>(() => {
    const seriesData = data.map((p) => [p.x, p.y]);

    return {
      grid: { top: 12, right: 16, bottom: 8, left: 44, containLabel: false },
      xAxis: {
        type: "value",
        show: false,
        min: data.length ? data[0].x : undefined,
        max: data.length ? data[data.length - 1].x : undefined,
      },
      yAxis: {
        type: "value",
        min: yDomain?.[0],
        max: yDomain?.[1],
        splitNumber: 4,
        axisLabel: { formatter: (v: number) => String(Math.round(v)) },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color, opacity: 0.5, width: 1 } },
        formatter: tooltipFormatter
          ? (params: unknown) => {
              const arr = params as { data: [number, number]; dataIndex: number }[];
              const first = arr[0];
              if (!first) return "";
              return tooltipFormatter({
                xValue: first.data[0],
                yValue: first.data[1],
                index: first.dataIndex,
              });
            }
          : undefined,
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: showDots ? "circle" : "none",
          symbolSize: 6,
          showSymbol: showDots,
          data: seriesData,
          lineStyle: { color, width: 2.5 },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexWithAlpha(color, fillGradientAlpha) },
                { offset: 1, color: hexWithAlpha(color, 0) },
              ],
            },
          },
          emphasis: {
            focus: "series",
            itemStyle: { borderColor: "rgba(0,0,0,0.6)", borderWidth: 2 },
          },
          markLine: markLines.length
            ? {
                symbol: "none",
                silent: true,
                lineStyle: { type: "dashed" },
                data: markLines.map((m) => ({
                  yAxis: m.y,
                  label: { formatter: m.label, color: m.color, fontSize: 10, opacity: 0.85 },
                  lineStyle: { color: m.color, opacity: m.opacity ?? 0.35 },
                })),
              }
            : undefined,
          markPoint: markPoints.length
            ? {
                symbolSize: 12,
                data: markPoints.map((p, i) => ({
                  name: p.label ?? `point-${i}`,
                  coord: [p.x, p.y],
                  itemStyle: p.ring
                    ? { color: "transparent", borderColor: p.color, borderWidth: 2 }
                    : { color: p.color, borderColor: "rgba(0,0,0,0.6)", borderWidth: 2 },
                  label: p.label
                    ? { formatter: p.label, color: p.color, fontSize: 10, position: "top" as const }
                    : { show: false },
                })),
              }
            : undefined,
          animationDuration: 600,
        },
      ],
    };
  }, [data, color, fillGradientAlpha, markLines, markPoints, yDomain, showDots, tooltipFormatter]);

  return <Chart option={option} height={height} ariaLabel={ariaLabel} />;
}

// Accepts #rrggbb; ignores rgb() / var(). Alpha in [0, 1].
function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith("#")) return hex; // Trust the caller to pass a resolvable color.
  const clean = hex.slice(1);
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
