"use client";
import Link from "next/link";
import { useState } from "react";

type Row = any;

export function HistoryList({ rows }: { rows: Row[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 10);

  if (rows.length === 0) {
    return <p className="text-text-mute">Aún no ha jugado partidas.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {visible.map((r) => (
          <HistoryRow key={`${r.match_id}-${r.team}`} row={r} />
        ))}
      </ul>
      {!expanded && rows.length > 10 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full text-sm text-primary hover:underline"
        >
          Ver más ({rows.length - 10})
        </button>
      )}
    </>
  );
}

function HistoryRow({ row: r }: { row: Row }) {
  const status = r.matches?.status as string | undefined;
  const isConfirmed = status === "confirmed";
  const isPending   = status === "pending_attestation";
  const isDisputed  = status === "disputed";
  const isVoid      = status === "void";
  const won = r.rank === 1;
  const hasRating = r.elo_before != null && r.elo_after != null;
  const delta = hasRating ? Number(r.elo_after) - Number(r.elo_before) : null;

  const mps = (r.matches?.match_players ?? []) as Array<{
    team: number; user_id: string; score: number;
    profiles: { username: string; display_name: string | null } | null;
  }>;
  const firstNameOf = (mp: typeof mps[0]) =>
    (mp.profiles?.display_name?.split(" ")[0]) ?? mp.profiles?.username ?? "?";
  const teamA = mps.filter((mp) => mp.team === 1);
  const teamB = mps.filter((mp) => mp.team === 2);
  const nameA = teamA.map(firstNameOf).join(" & ");
  const nameB = teamB.map(firstNameOf).join(" & ");
  const scoreA = teamA.reduce((s, mp) => s + (mp.score ?? 0), 0);
  const scoreB = teamB.reduce((s, mp) => s + (mp.score ?? 0), 0);
  const hasScore = scoreA > 0 || scoreB > 0;
  const winnerSide: "A" | "B" | null = !hasScore ? null : scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;
  const myTeamWon = r.team === 1 ? scoreA > scoreB : scoreB > scoreA;

  return (
    <li className="py-3">
      <Link href={`/matches/${r.match_id}`} className="block hover:bg-surface-2 -mx-2 px-2 py-1 rounded transition-colors">
        <div className="flex items-center gap-2 text-sm">
          <span className={`flex-1 truncate ${winnerSide === "A" ? "font-bold text-primary" : "text-text"}`}>{nameA || "?"}</span>
          {hasScore ? (
            <span className="font-mono tabular-nums shrink-0">
              <span className={winnerSide === "A" ? "text-primary font-bold" : ""}>{scoreA}</span>
              <span className="opacity-30 mx-1">—</span>
              <span className={winnerSide === "B" ? "text-primary font-bold" : ""}>{scoreB}</span>
            </span>
          ) : (
            <span className="text-text-mute text-xs shrink-0">vs</span>
          )}
          <span className={`flex-1 truncate text-right ${winnerSide === "B" ? "font-bold text-primary" : "text-text"}`}>{nameB || "?"}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-text-mute">
          <span>{new Date(r.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
          <span className="opacity-50">·</span>
          <span>Parejas · {r.matches?.target_points} pts</span>
          {isPending && <span className="badge bg-warning/15 text-warning ml-auto">Pendiente</span>}
          {isDisputed && <span className="badge bg-danger/15 text-danger ml-auto">Disputa</span>}
          {isVoid && <span className="badge bg-surface-3 text-text-mute ml-auto">Anulada</span>}
          {isConfirmed && hasRating && (
            <>
              <span className={`badge ml-auto ${myTeamWon ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                {won ? "Ganó" : "Perdió"}
              </span>
              <span className={`font-mono ${delta! >= 0 ? "text-primary" : "text-danger"}`}>
                {delta! >= 0 ? "+" : ""}{delta!}
              </span>
            </>
          )}
        </div>
      </Link>
    </li>
  );
}
