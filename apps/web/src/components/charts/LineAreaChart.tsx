"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";

export type LinePoint = { x: number; y: number };

export type LineAreaChartMarkLine = {
  y: number;
  label: string;
  color: string;
  /** When true the line renders solid + bold label — meant for the user's current tier. */
  highlight?: boolean;
  opacity?: number;
};

export type LineAreaChartMarkPoint = {
  x: number;
  y: number;
  color: string;
  label?: string;
  ring?: boolean;
  /** Renders the label as a filled pill instead of plain text. */
  pill?: boolean;
};

export type LineAreaChartXAxisTick = {
  /** Data-space x value where the tick sits. */
  x: number;
  label: string;
};

type Props = {
  data: LinePoint[];
  color: string;
  fillGradientAlpha?: number;
  markLines?: LineAreaChartMarkLine[];
  markPoints?: LineAreaChartMarkPoint[];
  /** If provided, renders a categorical-looking X axis with these labels at their x positions. */
  xAxisTicks?: LineAreaChartXAxisTick[];
  /** Position for `markLine` labels. `insideStartTop` floats them above the line, inside the chart area. */
  markLineLabelPosition?: "end" | "insideStartTop" | "insideEndTop" | "middle";
  /** Adds a pulsing ripple over the given point (typically the last one). */
  currentPoint?: { x: number; y: number; color: string };
  yDomain?: [number, number];
  showDots?: boolean;
  height?: number;
  ariaLabel: string;
  tooltipFormatter?: (params: { xValue: number; yValue: number; index: number }) => string;
  /** Extra pixels reserved for the plot area — bump when Y labels are wide. */
  leftPadding?: number;
  rightPadding?: number;
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
  xAxisTicks,
  markLineLabelPosition = "end",
  currentPoint,
  yDomain,
  showDots = false,
  height = 240,
  ariaLabel,
  tooltipFormatter,
  leftPadding = 44,
  rightPadding = 16,
}: Props) {
  const option = useMemo<EChartsOption>(() => {
    const seriesData = data.map((p) => [p.x, p.y]);
    const bottomPadding = xAxisTicks && xAxisTicks.length > 0 ? 28 : 8;

    return {
      grid: { top: 12, right: rightPadding, bottom: bottomPadding, left: leftPadding, containLabel: false },
      xAxis: {
        type: "value",
        show: !!(xAxisTicks && xAxisTicks.length),
        min: data.length ? data[0].x : undefined,
        max: data.length ? data[data.length - 1].x : undefined,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: xAxisTicks
          ? {
              interval: 0,
              fontSize: 10,
              showMinLabel: true,
              showMaxLabel: true,
              formatter: (value: number) => {
                const match = xAxisTicks.find((t) => Math.abs(t.x - value) < 1);
                return match ? match.label : "";
              },
            }
          : undefined,
        // ECharts respects `interval` when we hand-pick the tick values via `data`-like config.
        // For type="value" we approximate by pinning min/max/data ticks:
        ...(xAxisTicks
          ? {
              interval:
                xAxisTicks.length >= 2
                  ? (xAxisTicks[xAxisTicks.length - 1].x - xAxisTicks[0].x) /
                    Math.max(1, xAxisTicks.length - 1)
                  : undefined,
            }
          : {}),
      },
      yAxis: {
        type: "value",
        min: yDomain?.[0],
        max: yDomain?.[1],
        splitNumber: 4,
        axisLabel: { formatter: (v: number) => formatYValue(v) },
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
                data: markLines.map((m) => ({
                  yAxis: m.y,
                  lineStyle: {
                    color: m.color,
                    opacity: m.opacity ?? (m.highlight ? 0.9 : 0.35),
                    type: m.highlight ? "solid" : "dashed",
                    width: m.highlight ? 2 : 1,
                  },
                  label: {
                    formatter: m.label,
                    color: m.color,
                    fontSize: m.highlight ? 11 : 10,
                    fontWeight: m.highlight ? 700 : 400,
                    opacity: m.highlight ? 1 : 0.85,
                    position: markLineLabelPosition as never,
                    padding: markLineLabelPosition === "insideStartTop" ? [0, 6, 3, 6] : undefined,
                  },
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
                    ? p.pill
                      ? {
                          formatter: p.label,
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          position: "top" as const,
                          padding: [3, 8, 3, 8],
                          borderRadius: 999,
                          backgroundColor: p.color,
                        }
                      : { formatter: p.label, color: p.color, fontSize: 10, position: "top" as const }
                    : { show: false },
                })),
              }
            : undefined,
          animationDuration: 600,
        },
        ...(currentPoint
          ? [
              {
                type: "effectScatter" as const,
                data: [[currentPoint.x, currentPoint.y]],
                symbolSize: 10,
                itemStyle: { color: currentPoint.color, borderColor: "#fff", borderWidth: 2 },
                rippleEffect: { period: 3, scale: 3.5, brushType: "stroke" as const },
                zlevel: 2,
              },
            ]
          : []),
      ],
    };
  }, [
    data,
    color,
    fillGradientAlpha,
    markLines,
    markPoints,
    xAxisTicks,
    markLineLabelPosition,
    currentPoint,
    yDomain,
    showDots,
    tooltipFormatter,
    leftPadding,
    rightPadding,
  ]);

  return <Chart option={option} height={height} ariaLabel={ariaLabel} />;
}

function formatYValue(v: number): string {
  // Integers show as-is; small decimals keep 1 place (DomiRank display is 1.0–20.0).
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
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
