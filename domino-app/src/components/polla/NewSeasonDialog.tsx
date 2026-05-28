"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNewSeason } from "@/lib/polla-actions";
import { useModalA11y } from "@/hooks/useModalA11y";

type Props = {
  tournamentId: string;
  currentSeason: number;
  onClose: () => void;
};

export function NewSeasonDialog({ tournamentId, currentSeason, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useModalA11y({ onClose });
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newSeason = currentSeason + 1;
  const canConfirm = confirmText.trim().toLowerCase() === "nueva temporada";

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    const res = await startNewSeason({
      tournament_id: tournamentId,
      confirm_name:  confirmText,
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-season-title"
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 animate-slide-up-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h2 id="new-season-title" className="text-lg font-semibold">Nueva temporada</h2>
        </div>

        <p className="text-sm">Vas a empezar la <strong>Temporada {newSeason}</strong>. Esto va a:</p>
        <ul className="text-sm text-text-mute space-y-1 pl-4 list-disc">
          <li>Resetear stats a 0 para todos en el leaderboard.</li>
          <li>El historial de partidas se mantiene.</li>
          <li>Los jugadores siguen siendo los mismos.</li>
        </ul>

        <div className="space-y-1.5">
          <label htmlFor="confirm-input" className="text-sm">
            Escribe <code className="font-mono bg-surface-2 px-1.5 rounded text-xs">nueva temporada</code> para confirmar:
          </label>
          <input
            id="confirm-input"
            type="text"
            placeholder="nueva temporada"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={`card w-full p-2.5 transition-colors ${canConfirm ? "border-primary ring-1 ring-primary/40" : ""}`}
            autoFocus
          />
          {confirmText.length > 0 && !canConfirm && (
            <p className="text-xs text-text-mute mt-1" aria-live="polite">
              Escribe exactamente "nueva temporada".
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary flex-1"
            disabled={!canConfirm || pending}
          >
            {pending ? "Procesando…" : `Empezar Temporada ${newSeason} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
