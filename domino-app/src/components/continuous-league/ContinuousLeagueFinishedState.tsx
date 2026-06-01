"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reopenContinuousLeagueMatch, deleteContinuousLeagueMatch, rematchContinuousLeagueMatch } from "@/lib/continuous-league-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  matchId:        string;
  tournamentId:   string;
  winnerName:     string;
  scoreA:         number;
  scoreB:         number;
  /** Solo el creator de la partida puede Editar/Eliminar. */
  isCreator:      boolean;
};

/**
 * Trophy state inline para partidas de polla en status='confirmed'.
 * Reemplaza el round panel cuando la partida terminó.
 *
 * Acciones disponibles:
 * - Revancha: crea otra partida con los mismos teams (server action).
 * - Volver a la polla: link a /tournaments/[id].
 * - Editar partida (creator only): re-abre status → in_progress.
 * - Eliminar partida (creator only): soft-delete (status='cancelled').
 */
export function ContinuousLeagueFinishedState({
  matchId, tournamentId, winnerName, scoreA, scoreB, isCreator,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  async function doRematch() {
    setPending(true);
    setError(null);
    const r = await rematchContinuousLeagueMatch(matchId);
    if (!r.ok) {
      setError(r.error);
      setPending(false);
      return;
    }
    router.push(`/matches/${r.match_id}/live`);
  }

  async function doReopen() {
    setConfirmReopen(false);
    setPending(true);
    setError(null);
    const r = await reopenContinuousLeagueMatch(matchId);
    if (!r.ok) {
      setError(r.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  async function doDelete() {
    setConfirmDelete(false);
    setPending(true);
    setError(null);
    const r = await deleteContinuousLeagueMatch(matchId);
    if (!r.ok) {
      setError(r.error);
      setPending(false);
      return;
    }
    router.push(`/tournaments/${tournamentId}`);
  }

  return (
    <>
      <div className="card text-center py-7">
        <div className="text-5xl mb-2" aria-hidden="true">🏆</div>
        <div className="text-text-mute text-[10px] uppercase tracking-[0.12em] font-semibold">Ganador</div>
        <div className="text-xl font-bold mt-1">{winnerName}</div>
        <div className="text-text-dim text-sm mt-1 tabular-nums">{scoreA} — {scoreB}</div>

        {error && (
          <div role="alert" className="mt-3 mx-auto max-w-xs p-2 bg-danger/10 border border-danger/30 rounded text-danger text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mt-5 flex-wrap">
          <button
            type="button"
            onClick={doRematch}
            className="btn-primary"
            disabled={pending}
          >
            {pending ? "Procesando…" : "Revancha"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/tournaments/${tournamentId}`)}
            className="btn-ghost"
            disabled={pending}
          >
            Volver a la polla
          </button>
        </div>

        {isCreator && (
          <div className="flex justify-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setConfirmReopen(true)}
              className="text-text-mute hover:text-text text-xs inline-flex items-center gap-1 px-2 py-1"
              disabled={pending}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
              Editar partida
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-danger hover:opacity-80 text-xs inline-flex items-center gap-1 px-2 py-1"
              disabled={pending}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              </svg>
              Eliminar partida
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReopen}
        title="¿Editar la partida?"
        description="Se va a reabrir para que puedas editar o borrar manos. Cuando una pareja llegue de nuevo a la meta, se finalizará otra vez."
        confirmLabel="Reabrir"
        cancelLabel="Cancelar"
        pending={pending}
        onConfirm={doReopen}
        onCancel={() => setConfirmReopen(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar la partida?"
        description="Se va a eliminar la partida y sus manos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        pending={pending}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
