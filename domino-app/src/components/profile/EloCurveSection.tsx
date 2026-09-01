"use client";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import type { EloPoint } from "@/lib/profile-stats";

type Range = "10" | "50" | "all";

export function EloCurveSection({
  points,
  points50,
  points10,
}: {
  points: EloPoint[];
  points50: EloPoint[];
  points10: EloPoint[];
}) {
  const [range, setRange] = useState<Range>("50");
  const active = range === "10" ? points10 : range === "50" ? points50 : points;

  const chartPoints = useMemo(() => active.map((p) => ({ x: p.timestamp, y: p.elo })), [active]);
  const peak = useMemo(() => {
    if (active.length === 0) return null;
    const top = active.reduce((a, b) => (b.elo > a.elo ? b : a));
    return { x: top.timestamp, y: top.elo, label: `${top.elo.toFixed(0)}` };
  }, [active]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Evolución de DomiRank</h2>
        <div className="inline-flex rounded-full bg-white/5 p-1 text-xs">
          {(["10", "50", "all"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full transition-colors ${range === r ? "bg-primary text-black font-semibold" : "text-text-mute"}`}
            >
              {r === "all" ? "Todas" : r}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        points={chartPoints}
        peak={peak}
        ariaLabel={`Curva de DomiRank últimos ${range === "all" ? "todos" : range} partidas`}
      />
    </div>
  );
}
