"use client";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  ariaLabel: string;
};

export function RingStat({ value, label, sublabel, size = 140, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const clamp = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const offset = C * (1 - clamp / 100);

  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={ariaLabel}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={stroke} />
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#10b981" strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeDasharray={C}
          initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 0.8, ease: "easeOut" }}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-current" fontSize={size * 0.25} fontWeight={700}>
          {clamp.toFixed(0)}%
        </text>
      </svg>
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold">{label}</div>
        {sublabel && <div className="text-xs text-text-mute mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
