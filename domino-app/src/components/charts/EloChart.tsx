"use client";
import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
  CartesianGrid, ReferenceDot,
} from "recharts";
import { SKILL_TIERS, displayToElo } from "@/lib/rating";

export type EloChartPoint = {
  timestamp: number;
  elo: number;
  day: string;
};

type Props = {
  points: EloChartPoint[];
  showDots?: boolean;
  ariaLabel: string;
  height?: number;
};

const BRAND = "#10b981";
const PEAK  = "#fbbf24";

export function EloChart({ points, showDots = false, ariaLabel, height = 240 }: Props) {
  const data = useMemo(() => {
    const withDelta: Array<EloChartPoint & { delta: number | null }> = [];
    for (let i = 0; i < points.length; i++) {
      const prev = i > 0 ? points[i - 1].elo : null;
      withDelta.push({ ...points[i], delta: prev == null ? null : points[i].elo - prev });
    }
    return withDelta;
  }, [points]);

  const { peak, minElo, maxElo, last } = useMemo(() => {
    if (data.length === 0) return { peak: null, minElo: 0, maxElo: 0, last: null };
    const eloOnly = data.map((d) => d.elo);
    const maxE = Math.max(...eloOnly);
    const minE = Math.min(...eloOnly);
    const peakPoint = data.find((d) => d.elo === maxE) ?? null;
    return { peak: peakPoint, minElo: minE, maxElo: maxE, last: data[data.length - 1] };
  }, [data]);

  const tierRefs = useMemo(() => {
    return SKILL_TIERS
      .map((t) => ({ name: t.name, color: t.color, elo: Math.round(displayToElo(t.min)) }))
      .filter((t) => t.elo > minElo && t.elo < maxElo);
  }, [minElo, maxElo]);

  if (data.length < 2) {
    return (
      <div className="text-text-mute text-sm py-8 text-center" role="img" aria-label={ariaLabel}>
        Aún no hay suficientes partidas para dibujar la curva.
      </div>
    );
  }

  const pad = Math.max(15, Math.round((maxElo - minElo) * 0.15));
  const yDomain: [number, number] = [Math.max(1000, minElo - pad), maxElo + pad];

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
          <XAxis dataKey="timestamp" hide />
          <YAxis
            domain={yDomain}
            width={44}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            tickFormatter={(v) => String(Math.round(Number(v)))}
          />
          {tierRefs.map((t) => (
            <ReferenceLine
              key={t.name}
              y={t.elo}
              stroke={t.color}
              strokeOpacity={0.35}
              strokeDasharray="3 3"
              label={{ value: t.name, position: "insideTopRight", fill: t.color, fontSize: 10, opacity: 0.7 }}
            />
          ))}
          <Tooltip
            cursor={{ stroke: BRAND, strokeOpacity: 0.4, strokeWidth: 1 }}
            content={<CustomTooltip />}
          />
          <Area
            type="monotone"
            dataKey="elo"
            stroke={BRAND}
            strokeWidth={2.5}
            fill="url(#eloFill)"
            dot={showDots ? { r: 3, fill: BRAND, stroke: "transparent" } : false}
            activeDot={{ r: 5, fill: BRAND, stroke: "#0b1220", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={600}
          />
          {peak && last && peak.timestamp !== last.timestamp && (
            <ReferenceDot x={peak.timestamp} y={peak.elo} r={4} fill="none" stroke={PEAK} strokeWidth={2}
              label={{ value: `pico ${peak.elo}`, position: "top", fill: PEAK, fontSize: 10 }}
            />
          )}
          {last && (
            <ReferenceDot x={last.timestamp} y={last.elo} r={5} fill={BRAND} stroke="#0b1220" strokeWidth={2} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as EloChartPoint & { delta: number | null };
  const date = new Date(p.timestamp).toLocaleDateString("es", { day: "numeric", month: "short" });
  const delta = p.delta;
  return (
    <div className="rounded-md bg-surface-2 border border-border px-3 py-2 shadow-lg text-xs">
      <div className="font-mono font-bold text-sm">Elo {p.elo}</div>
      <div className="text-text-mute mt-0.5">{date}</div>
      {delta != null && (
        <div className={`font-mono mt-1 ${delta >= 0 ? "text-primary" : "text-danger"}`}>
          {delta >= 0 ? "+" : ""}{delta} vs anterior
        </div>
      )}
    </div>
  );
}
