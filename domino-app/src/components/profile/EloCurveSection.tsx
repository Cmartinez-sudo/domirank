"use client";
import { useMemo, useState } from "react";
import { EloChart } from "@/components/charts/EloChart";
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

  const chartPoints = useMemo(
    () => active.map((p) => ({ timestamp: p.timestamp, elo: p.elo, day: p.day })),
    [active]
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">Evolución de tu DomiRank</h2>
          <p className="text-text-mute text-xs mt-0.5">Cómo cambia tu nivel con cada partida jugada.</p>
        </div>
        <div className="inline-flex rounded-full bg-surface-2 border border-border p-1 text-xs">
          {(["10", "50", "all"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full transition-colors ${range === r ? "bg-primary text-primary-ink font-semibold" : "text-text-mute"}`}
            >
              {r === "all" ? "Todas" : r}
            </button>
          ))}
        </div>
      </div>
      <EloChart
        points={chartPoints}
        showDots={range === "10"}
        ariaLabel={`Curva de Elo últimos ${range === "all" ? "todos" : range} partidas`}
      />
    </div>
  );
}
