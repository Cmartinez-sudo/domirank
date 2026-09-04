"use client";

import { NumberCounter } from "@/components/Motion";

/**
 * Big animated rating number with the DomiRank gradient fill. The gradient
 * uses inline `-webkit-text-fill-color` because Tailwind has no utility
 * for it; the numeric value is counted up by `NumberCounter`.
 *
 * Gradient hex values match the brand colors and stay the same in both
 * themes intentionally — this is the DomiRank identity color.
 */
export function RatingNumberHero({
  value,
  fontSize = "3.5rem",
}: {
  value: number;
  fontSize?: string;
}) {
  return (
    <span
      className="font-mono font-extrabold tabular-nums shrink-0"
      style={{
        fontSize,
        lineHeight: 1,
        backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      <NumberCounter value={value} decimals={1} />
    </span>
  );
}
