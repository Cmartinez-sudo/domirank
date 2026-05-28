"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closePolla } from "@/lib/polla-actions";
import { useModalA11y } from "@/hooks/useModalA11y";

type Props = {
  tournamentId: string;
  onClose: () => void;
};

export function ClosePollaDialog({ tournamentId, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useModalA11y({ onClose });
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim().toLowerCase() === "cerrar polla";

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    const res = await closePolla(tournamentId);
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
        aria-labelledby="close-polla-title"
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 animate-slide-up-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-danger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h2 id="close-polla-title" className="text-lg font-semibold">Cerrar polla</h2>
        </div>

        <p className="text-sm">Vas a cerrar esta polla. Esto va a:</p>
        <ul className="text-sm text-text-mute space-y-1 pl-4 list-disc">
          <li>Bloquear la creación de nuevas partidas.</li>
          <li>Marcar la polla como <strong>finalizada</strong>.</li>
          <li>Preservar todo el historial y stats.</li>
          <li><strong>No se puede revertir.</strong></li>
        </ul>

        <div className="space-y-1.5">
          <label htmlFor="close-confirm-input" className="text-sm">
            Escribí <code className="font-mono bg-surface-2 px-1.5 rounded text-xs">cerrar polla</code> para confirmar:
          </label>
          <input
            id="close-confirm-input"
            type="text"
            placeholder="cerrar polla"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={`card w-full p-2.5 transition-colors ${canConfirm ? "border-danger ring-1 ring-danger/40" : ""}`}
            autoFocus
          />
          {confirmText.length > 0 && !canConfirm && (
            <p className="text-xs text-text-mute mt-1" aria-live="polite">
              Escribí exactamente "cerrar polla".
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
            className="btn flex-1 bg-danger text-white hover:bg-danger/90 disabled:opacity-50 active:scale-[.97]"
            disabled={!canConfirm || pending}
          >
            {pending ? "Cerrando…" : "Cerrar polla"}
          </button>
        </div>
      </div>
    </div>
  );
}
