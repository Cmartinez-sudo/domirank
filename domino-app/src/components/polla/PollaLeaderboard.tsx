import type { PollaStandingsRow } from "@/types/polla";

type Props = {
  rows: PollaStandingsRow[];
  currentUserId: string;
};

export function PollaLeaderboard({ rows, currentUserId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-text-mute">
        Sin partidas todavía. Tocá "+ Nueva partida" para empezar.
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden" role="table" aria-label="Leaderboard de la polla">
      <div role="rowgroup">
        <div
          role="row"
          className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2 text-text-mute text-xs font-medium uppercase border-b border-border"
        >
          <div role="columnheader" aria-label="Posición">#</div>
          <div role="columnheader">Jugador</div>
          <div role="columnheader" aria-label="Puntos" className="text-right">Pts</div>
          <div role="columnheader" aria-label="Victorias" className="text-right">W</div>
          <div role="columnheader" aria-label="Derrotas" className="text-right">L</div>
          <div role="columnheader" aria-label="Porcentaje de victorias" className="text-right">%</div>
          <div role="columnheader" aria-label="Racha actual" className="text-right">Racha</div>
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row, i) => {
          const isCurrent = row.user_id === currentUserId;
          return (
            <div
              key={row.user_id}
              role="row"
              data-user-id={row.user_id}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-3 text-sm border-b border-border/30 last:border-0 ${
                isCurrent ? "bg-primary/10" : ""
              }`}
            >
              <div role="cell" className="font-semibold text-text-mute">{i + 1}</div>
              <div role="cell" data-testid="player-name" className="font-medium truncate">
                {row.display_name ?? row.username}
              </div>
              <div role="cell" className="text-right [font-variant-numeric:tabular-nums]">{row.total_points}</div>
              <div role="cell" className="text-right [font-variant-numeric:tabular-nums]">{row.wins}</div>
              <div role="cell" className="text-right [font-variant-numeric:tabular-nums]">{row.losses}</div>
              <div role="cell" className="text-right [font-variant-numeric:tabular-nums]">{row.win_pct}%</div>
              <div role="cell" className="text-right [font-variant-numeric:tabular-nums] text-xs">{row.current_streak}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
