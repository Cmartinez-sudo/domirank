"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";

type Props = {
  value: number;
  color: string;
  max?: number;
  height?: number;
  ariaLabel: string;
};

/**
 * Horizontal single-bar chart used for progress-style stats (win rate,
 * effectiveness). Track is drawn as a full-width background series so the
 * bar always sits inside a well-defined box even at value = 0.
 */
export function BarChart({ value, color, max = 100, height = 12, ariaLabel }: Props) {
  const clamp = Math.max(0, Math.min(max, value));
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 0, right: 0, bottom: 0, left: 0, containLabel: false },
      xAxis: { type: "value", show: false, max },
      yAxis: { type: "category", show: false, data: [""] },
      tooltip: { show: false },
      series: [
        {
          // Track background
          type: "bar",
          data: [max],
          barWidth: height,
          barGap: "-100%",
          itemStyle: { color: "rgba(148, 163, 184, 0.18)", borderRadius: 999 },
          silent: true,
          z: 1,
        },
        {
          // Actual value
          type: "bar",
          data: [clamp],
          barWidth: height,
          itemStyle: { color, borderRadius: 999 },
          animationDuration: 700,
          animationEasing: "cubicOut",
          z: 2,
        },
      ],
    }),
    [clamp, color, max, height],
  );

  return <Chart option={option} height={height + 4} ariaLabel={ariaLabel} />;
}
