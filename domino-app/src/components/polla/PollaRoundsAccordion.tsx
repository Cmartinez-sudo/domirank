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

function statusIcon(status: PollaMatchPreview["status"]): string {
  switch (status) {
    case "confirmed":   return "✅";
    case "in_progress": return "⏳";
    default:            return "⌛";
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
              onClick={() => toggle(r.round_number)}
              className="w-full px-3 py-3 flex items-center justify-between text-left hover:bg-surface-2 transition-colors"
            >
              <div className="font-semibold">
                Ronda {r.round_number}
                {isCurrent && <span className="text-text-mute text-xs ml-2 font-normal">(actual)</span>}
              </div>
              <div className="text-text-mute text-sm" aria-hidden="true">{isOpen ? "▾" : "▸"}</div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {r.matches.map((m) => (
                  <div key={m.match_id} className="flex items-center gap-2 text-sm">
                    <span className="text-base" aria-hidden="true">{statusIcon(m.status)}</span>
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
