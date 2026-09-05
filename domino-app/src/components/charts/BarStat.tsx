"use client";
import { BarChart } from "./BarChart";

type Props = {
  value: number;
  label: string;
  sublabel?: string;
  ariaLabel: string;
};

const PRIMARY = "#10b981";

/**
 * Horizontal progress stat with label + value. Refactored to use
 * `BarChart` (ECharts) for the bar; label/value/sublabel stay as plain
 * DOM to keep the surrounding layout identical.
 */
export function BarStat({ value, label, sublabel, ariaLabel }: Props) {
  const clamp = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-mono font-bold tabular-nums">{clamp.toFixed(1)}%</span>
      </div>
      <BarChart value={clamp} color={PRIMARY} height={12} ariaLabel={ariaLabel} />
      {sublabel && <div className="text-xs text-text-mute mt-1">{sublabel}</div>}
    </div>
  );
}
