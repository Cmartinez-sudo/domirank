"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { transferScoreKeeper } from "@/lib/score-keeper";

type PlayerOption = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  matchId: string;
  /** Current score-keeper id. Hidden from candidate list. */
  currentKeeperId: string;
  /** Other players in the match. */
  candidates: PlayerOption[];
};

/**
 * Button + sheet: lets the current score-keeper hand off the role to
 * another player in the match. Spec C5.
 *
 * Flow:
 *   1. Tap "Transferir registro" → reveals candidate list inline.
 *   2. Tap a candidate → confirmation dialog.
 *   3. Confirm → calls `transferScoreKeeper` server action.
 *   4. On success, server revalidates the live route; receiver gets
 *      an in-app notification via `notifications` table.
 */
export function ScoreKeeperTransfer({ matchId, currentKeeperId, candidates }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = candidates.filter((c) => c.id !== currentKeeperId);
  if (filtered.length === 0) return null;

  const picked = filtered.find((c) => c.id === pickedId) ?? null;

  function handleConfirm() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const r = await transferScoreKeeper(matchId, picked.id);
      if (!r.ok) {
        setError(r.error);
      } else {
        setExpanded(false);
        setPickedId(null);
      }
    });
  }

  return (
    <div className="mt-3">
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="btn-ghost w-full text-sm"
        >
          Transferir registro de puntos
        </button>
      )}

      {expanded && (
        <div className="card p-3 mt-1">
          <div className="text-xs text-text-mute mb-2">
            Pasale el registro a:
          </div>
          <ul className="divide-y divide-border/40">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(p.id)}
                  className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-surface-2/60 rounded"
                  disabled={pending}
                >
                  <Avatar player={p} size={28} />
                  <span className="flex-1 truncate text-sm">
                    {p.display_name ?? p.username}
                  </span>
                  <span className="text-text-mute text-xs">@{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { setExpanded(false); setPickedId(null); }}
            className="text-text-mute text-xs mt-2"
            disabled={pending}
          >
            Cancelar
          </button>
          {error && (
            <div className="mt-2 p-2 bg-danger/10 border border-danger/30 rounded text-danger text-xs">
              {error}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={picked !== null}
        title="¿Transferir el registro?"
        description={picked
          ? `${picked.display_name ?? picked.username} podrá registrar manos. Vos perderás esa capacidad inmediatamente.`
          : ""}
        confirmLabel={pending ? "Transfiriendo…" : "Sí, transferir"}
        cancelLabel="Cancelar"
        onCancel={() => setPickedId(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
