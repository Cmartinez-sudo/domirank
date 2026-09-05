import type { H2HResult } from "@/lib/profile-stats";

type SideStat = { display: number; win_rate: number; effectiveness: number; games: number };

export function H2HCard({
  themName,
  meStat,
  themStat,
  h2h,
}: {
  themName: string;
  meStat: SideStat;
  themStat: SideStat;
  h2h: H2HResult;
}) {
  const rows: Array<{ label: string; me: string; them: string; better: "me" | "them" | null }> = [
    { label: "DomiRank",    me: meStat.display.toFixed(1),                        them: themStat.display.toFixed(1),                        better: meStat.display === themStat.display ? null : meStat.display > themStat.display ? "me" : "them" },
    { label: "Win rate",    me: `${(meStat.win_rate * 100).toFixed(0)}%`,         them: `${(themStat.win_rate * 100).toFixed(0)}%`,         better: meStat.win_rate === themStat.win_rate ? null : meStat.win_rate > themStat.win_rate ? "me" : "them" },
    { label: "Efectividad", me: `${(meStat.effectiveness * 100).toFixed(0)}%`,    them: `${(themStat.effectiveness * 100).toFixed(0)}%`,    better: meStat.effectiveness === themStat.effectiveness ? null : meStat.effectiveness > themStat.effectiveness ? "me" : "them" },
    { label: "Partidas",    me: String(meStat.games),                              them: String(themStat.games),                              better: null },
  ];

  const delta = meStat.display - themStat.display;
  const deltaFmt = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Tú vs {themName}</h2>
      {h2h.vs.games === 0 ? (
        <p className="text-text-mute text-sm">Aún no se han enfrentado en una partida confirmada.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-center mb-4">
            <div className="bg-primary/10 rounded-lg py-3">
              <div className="text-3xl font-mono font-bold text-primary">{h2h.vs.my_wins}</div>
              <div className="text-xs text-text-mute uppercase tracking-wide mt-1">Ganaste</div>
            </div>
            <div className="bg-danger/10 rounded-lg py-3">
              <div className="text-3xl font-mono font-bold text-danger">{h2h.vs.their_wins}</div>
              <div className="text-xs text-text-mute uppercase tracking-wide mt-1">Perdiste</div>
            </div>
          </div>
          <div className="text-xs text-text-mute text-center mb-4">Δ DomiRank: <span className="font-mono">{deltaFmt}</span></div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center py-2 text-sm">
                <span className={`flex-1 tabular-nums font-mono text-right ${r.better === "me" ? "text-primary font-bold" : ""}`}>{r.me}</span>
                <span className="w-28 text-center text-xs text-text-mute uppercase tracking-wide">{r.label}</span>
                <span className={`flex-1 tabular-nums font-mono ${r.better === "them" ? "text-primary font-bold" : ""}`}>{r.them}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {h2h.together.games > 0 && (
        <p className="text-xs text-text-mute mt-4">Además, jugaron {h2h.together.games} {h2h.together.games === 1 ? "partida" : "partidas"} juntos: <span className="text-primary">{h2h.together.wins}V</span>-<span className="text-danger">{h2h.together.losses}D</span>.</p>
      )}
    </div>
  );
}
