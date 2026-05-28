"use client";

import { useRouter } from "next/navigation";

export type PollaMatchRow = {
  match_id:        string;
  status:          "in_progress" | "completed" | "confirmed" | "pending_attestation";
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  score_a:         number;
  score_b:         number;
  winner_team:     1 | 2 | null;
  created_at:      string;
};

type Props = {
  matches: PollaMatchRow[];
  userNames: Record<string, string>;
};

function pairName(ids: string[], names: Record<string, string>): string {
  return ids.map((id) => names[id] ?? "?").join(" & ");
}

/**
 * Lista plana de partidas de la polla, más recientes arriba.
 * Reemplaza el viejo PollaRoundsAccordion.
 *
 * - Partida `in_progress`: borde naranja + ruta a `/live`
 * - Partida finalizada (`completed`/`confirmed`): ruta a `/matches/[id]`
 */
export function PollaMatchesList({ matches, userNames }: Props) {
  const router = useRouter();

  if (matches.length === 0) {
    return (
      <div className="card">
        <div className="font-semibold mb-1">Partidas</div>
        <div className="py-6 text-center text-text-dim text-sm">
          Aún no hay partidas. Toca "Jugar nueva partida" para empezar.
        </div>
      </div>
    );
  }

  const sorted = [...matches].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border font-semibold">Partidas ({matches.length})</div>
      <div className="divide-y divide-border/40">
        {sorted.map((m) => {
          const isLive = m.status === "in_progress";
          const target = isLive ? `/matches/${m.match_id}/live` : `/matches/${m.match_id}`;
          const winA = m.winner_team === 1;
          const winB = m.winner_team === 2;
          return (
            <button
              key={m.match_id}
              type="button"
              onClick={() => router.push(target)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-surface-2 transition text-left ${
                isLive ? "border-l-4 border-warning bg-warning/5" : ""
              }`}
            >
              <div className={`flex-1 min-w-0 truncate ${winA ? "font-bold text-primary" : ""}`}>
                {pairName(m.team_a_user_ids, userNames)}
              </div>
              <div className="font-mono tabular-nums shrink-0 px-2">
                <span className={winA ? "text-primary font-bold" : ""}>{m.score_a}</span>
                <span className="opacity-30 mx-1">—</span>
                <span className={winB ? "text-primary font-bold" : ""}>{m.score_b}</span>
              </div>
              <div className={`flex-1 min-w-0 truncate text-right ${winB ? "font-bold text-primary" : ""}`}>
                {pairName(m.team_b_user_ids, userNames)}
              </div>
              {isLive && (
                <span className="ml-2 badge bg-warning/15 text-warning text-xs shrink-0">en curso</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
