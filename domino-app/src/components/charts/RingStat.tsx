"use client";
import { GaugeChart } from "./GaugeChart";

type Props = {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  ariaLabel: string;
};

const PRIMARY = "#10b981";

/**
 * Circular progress stat. Refactored to use `GaugeChart` (ECharts). Same
 * external API — callers pass `value`, `label`, optional `sublabel`,
 * `size`. The gauge itself is centered inside a fixed-size box so
 * layout stays stable next to sibling cards.
 */
export function RingStat({ value, label, sublabel, size = 140, ariaLabel }: Props) {
  return (
    <div className="inline-flex flex-col items-center" style={{ width: size }}>
      <GaugeChart value={value} color={PRIMARY} size={size} ariaLabel={ariaLabel} />
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold">{label}</div>
        {sublabel && <div className="text-xs text-text-mute mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
