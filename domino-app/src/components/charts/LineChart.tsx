"use client";
import { motion, useReducedMotion } from "framer-motion";

type Point = { x: number; y: number; label?: string };

type Props = {
  points: Point[];
  height?: number;
  ariaLabel: string;
  peak?: Point | null;
  color?: string;
};

export function LineChart({ points, height = 180, ariaLabel, peak = null, color = "#10b981" }: Props) {
  const reduced = useReducedMotion();
  if (points.length < 2) {
    return (
      <div className="text-text-mute text-sm py-8 text-center" role="img" aria-label={ariaLabel}>
        Aún no hay suficientes partidas para dibujar la curva.
      </div>
    );
  }

  const W = 600, H = height, padL = 8, padR = 8, padT = 12, padB = 24;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const px = (x: number) => padL + ((x - minX) / spanX) * (W - padL - padR);
  const py = (y: number) => padT + (1 - (y - minY) / spanY) * (H - padT - padB);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const peakPos = peak ? { cx: px(peak.x), cy: py(peak.y) } : null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" role="img" aria-label={ariaLabel} style={{ height }}>
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity={0.1} />
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: "easeOut" }}
        />
        <motion.circle
          cx={px(last.x)}
          cy={py(last.y)}
          r={5}
          fill={color}
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.9, duration: 0.2 }}
        />
        {peakPos && (
          <>
            <circle cx={peakPos.cx} cy={peakPos.cy} r={4} fill="none" stroke="#fbbf24" strokeWidth={2} />
            <text x={peakPos.cx} y={Math.max(padT + 8, peakPos.cy - 8)} textAnchor="middle" fontSize={11} fill="#fbbf24">
              {peak!.label ?? `pico ${peak!.y.toFixed(0)}`}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
