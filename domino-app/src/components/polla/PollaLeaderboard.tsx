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
    <div className="card p-0 overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2 text-text-mute text-xs font-medium uppercase border-b border-border">
        <div>#</div>
        <div>Jugador</div>
        <div className="text-right">Pts</div>
        <div className="text-right">W</div>
        <div className="text-right">L</div>
        <div className="text-right">%</div>
        <div className="text-right">Racha</div>
      </div>

      {rows.map((row, i) => {
        const isCurrent = row.user_id === currentUserId;
        return (
          <div
            key={row.user_id}
            data-user-id={row.user_id}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2.5 text-sm border-b border-border/30 last:border-0 ${
              isCurrent ? "bg-primary/10" : ""
            }`}
          >
            <div className="font-semibold text-text-mute">{i + 1}</div>
            <div data-testid="player-name" className="font-medium truncate">
              {row.display_name ?? row.username}
            </div>
            <div className="text-right font-mono">{row.total_points}</div>
            <div className="text-right">{row.wins}</div>
            <div className="text-right">{row.losses}</div>
            <div className="text-right">{row.win_pct}%</div>
            <div className="text-right font-mono text-xs">{row.current_streak}</div>
          </div>
        );
      })}
    </div>
  );
}
