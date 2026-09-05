"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";

type Props = {
  value: number;
  color: string;
  size?: number;
  ariaLabel: string;
  /** Optional center text override — otherwise renders "{value}%". */
  detail?: string;
};

/**
 * Circular gauge (0–100). Replacement for the hand-rolled SVG `RingStat`.
 * Uses ECharts' `gauge` type with a partial arc — clean animation on mount
 * and clean re-animation when `value` changes.
 */
export function GaugeChart({ value, color, size = 140, ariaLabel, detail }: Props) {
  const clamp = Math.max(0, Math.min(100, value));
  const option = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: "gauge",
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          radius: "88%",
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, "rgba(148, 163, 184, 0.18)"]],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, 0],
            formatter: () => detail ?? `${Math.round(clamp)}%`,
            color: "auto",
            fontSize: Math.round(size * 0.22),
            fontWeight: 700,
          },
          data: [{ value: clamp }],
          animationDuration: 800,
        },
      ],
    }),
    [clamp, color, size, detail],
  );

  return <Chart option={option} height={size} className="mx-auto" ariaLabel={ariaLabel} />;
}
