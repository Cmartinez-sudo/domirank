"use client";

import { useState } from "react";
import type { PollaMatchPreview, PollaRoundGroup } from "@/types/polla";

type Props = {
  rounds: PollaRoundGroup[];
  /** ID de la ronda actual para mantenerla expandida por default */
  currentRoundNumber: number;
  /** Map de user_id → display_name, usado para renderizar pairings */
  userNames: Record<string, string>;
};

function pairingLabel(userIds: string[], userNames: Record<string, string>): string {
  return userIds.map((id) => userNames[id] ?? "?").join(" & ");
}

function statusBadge(status: PollaMatchPreview["status"]): JSX.Element {
  switch (status) {
    case "confirmed":
      return (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="sr-only">Confirmada</span>
        </>
      );
    case "in_progress":
      return (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning flex-shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="sr-only">En curso</span>
        </>
      );
    default:
      return (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-mute flex-shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          <span className="sr-only">Pendiente</span>
        </>
      );
  }
}

export function PollaRoundsAccordion({ rounds, currentRoundNumber, userNames }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([currentRoundNumber]));

  function toggle(n: number) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className="card p-0 overflow-hidden">
      {rounds.map((r) => {
        const isOpen = expanded.has(r.round_number);
        const isCurrent = r.round_number === currentRoundNumber;
        return (
          <div key={r.round_number} className="border-b border-border/30 last:border-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`polla-round-${r.round_number}`}
              onClick={() => toggle(r.round_number)}
              className="w-full px-3 py-3 flex items-center justify-between text-left hover:bg-surface-2 active:bg-surface-3 transition-colors"
            >
              <div className="font-semibold">
                Ronda {r.round_number}
                {isCurrent && <span className="text-text-mute text-xs ml-2 font-normal">(actual)</span>}
              </div>
              <div className="text-text-mute text-sm" aria-hidden="true">{isOpen ? "▾" : "▸"}</div>
            </button>
            {isOpen && (
              <div id={`polla-round-${r.round_number}`} role="region" aria-label={`Ronda ${r.round_number}`} className="px-3 pb-3 space-y-1.5">
                {r.matches.map((m) => (
                  <div key={m.match_id} className="flex items-center gap-2 text-sm">
                    <span className="flex items-center">{statusBadge(m.status)}</span>
                    <span className="flex-1 truncate">
                      {pairingLabel(m.team_a_user_ids, userNames)}
                      {m.status === "confirmed"
                        ? ` ${m.team_a_score} — ${m.team_b_score} `
                        : " vs "}
                      {pairingLabel(m.team_b_user_ids, userNames)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
