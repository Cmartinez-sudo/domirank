import type { StreakResult, FormChip, HeatmapCell } from "@/lib/profile-stats";
import { FormStrip } from "@/components/charts/FormStrip";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { StreakBadge } from "@/components/celebration/StreakBadge";

export function StreaksSection({
  streaks, form, heatmap,
}: {
  streaks: StreakResult; form: FormChip[]; heatmap: HeatmapCell[];
}) {
  const currentBadge = (() => {
    const { kind, count } = streaks.current;
    if (kind === "none" || count < 2) return null;
    if (kind === "wins")   return <StreakBadge count={count} />;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-3 text-text-mute text-sm font-semibold">Racha: {count} derrotas</span>;
  })();

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Actividad</h2>
        {currentBadge}
      </div>
      <ActivityHeatmap cells={heatmap} ariaLabel="Heatmap de actividad últimas 12 semanas" />
      <div>
        <div className="text-xs text-text-mute uppercase tracking-wide mb-2">Forma reciente</div>
        <FormStrip chips={form} ariaLabel="Últimas 10 partidas" />
      </div>
      {streaks.best > 0 && (
        <div className="text-xs text-text-mute">Mejor racha histórica: <span className="text-text font-semibold">{streaks.best} victorias seguidas</span></div>
      )}
    </div>
  );
}
