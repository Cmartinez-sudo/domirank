"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoMatchCancellation } from "@/lib/live-match";

type CancelledBy = {
  username: string;
  display_name: string | null;
} | null;

type Props = {
  matchId: string;
  undoUntilIso: string | null;
  cancelledBy: CancelledBy;
  cancelledAtIso: string | null;
  reason: string | null;
  /** True si el viewer es match_player (puede usar undo). */
  canUndo: boolean;
};

/**
 * Banner que aparece en /matches/[id] cuando la partida está cancelled.
 * Spec MC4.
 *
 * Estados:
 *   • dentro de undo window + canUndo → variante warning ámbar con
 *     countdown live + botón "Revertir cancelación".
 *   • ventana expirada o cancelación sistémica → variante muted con
 *     "Esta partida fue cancelada el X. No afectó el rating de nadie."
 */
export function CancellationUndoBanner({
  matchId, undoUntilIso, cancelledBy, cancelledAtIso, reason, canUndo,
}: Props) {
  const router = useRouter();
  const [remainingSec, setRemainingSec] = useState<number>(() => {
    if (!undoUntilIso) return 0;
    const ms = new Date(undoUntilIso).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expired, setExpired] = useState<boolean>(remainingSec === 0);

  useEffect(() => {
    if (!undoUntilIso || remainingSec === 0) {
      setExpired(true);
      return;
    }
    const tick = setInterval(() => {
      const ms = new Date(undoUntilIso).getTime() - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setRemainingSec(sec);
      if (sec === 0) {
        setExpired(true);
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [undoUntilIso, remainingSec]);

  const cancellerName = cancelledBy?.display_name ?? cancelledBy?.username ?? "Alguien";
  const formattedDate = cancelledAtIso
    ? new Date(cancelledAtIso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  const reasonLabel = reasonToCopy(reason);

  function handleUndo() {
    setError(null);
    startTransition(async () => {
      const r = await undoMatchCancellation(matchId);
      if (!r.ok) {
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  // Muted variant: undo window expired OR systemic cancellation OR not a participant
  if (expired || !undoUntilIso || !canUndo) {
    return (
      <div
        role="status"
        className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-dim"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden="true">⛔</span>
          <div>
            <p>
              <strong className="text-text">Partida cancelada</strong>
              {formattedDate && <span className="text-text-mute"> · {formattedDate}</span>}
              {reason && reason !== "user_cancelled" && (
                <span className="text-text-mute"> · {reasonLabel}</span>
              )}
            </p>
            <p className="mt-1 text-xs">No afectó el rating de los participantes.</p>
          </div>
        </div>
      </div>
    );
  }

  // Active variant: warning, with countdown + undo button.
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;

  return (
    <div
      role="alertdialog"
      aria-labelledby="cancel-undo-title"
      className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-warning text-lg">⚠️</span>
        <div className="flex-1 min-w-0">
          <p id="cancel-undo-title" className="font-medium text-text">
            {cancellerName} canceló esta partida
          </p>
          <p className="text-xs text-text-dim mt-1 tabular-nums">
            Tenés <span className="font-mono font-semibold text-warning">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span> para revertirlo
          </p>
          {error && (
            <p className="text-xs text-danger mt-1.5">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleUndo}
          disabled={pending}
          className="btn-primary text-xs px-3 py-1.5 shrink-0 disabled:opacity-60"
        >
          {pending ? "Revirtiendo…" : "Revertir"}
        </button>
      </div>
    </div>
  );
}

function reasonToCopy(reason: string | null): string {
  switch (reason) {
    case "user_cancelled":          return "cancelada por un jugador";
    case "inactivity_auto":         return "auto-cancelada por inactividad";
    case "migration_cleanup":       return "auto-cancelada (limpieza)";
    case "replaced_by_new_match":   return "reemplazada por partida nueva";
    case "host_no_show":            return "el host nunca apareció";
    default:                        return "cancelada";
  }
}
