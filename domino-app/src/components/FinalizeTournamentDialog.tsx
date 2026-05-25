"use client";

import { useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { motion, AnimatePresence } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type Props = {
  open: boolean;
  tournamentName: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmación tipada para finalizar un torneo.
 * El botón "Finalizar" se habilita solo cuando el usuario escribe el nombre
 * exacto del torneo (case-sensitive), al estilo GitHub delete-repo.
 */
export function FinalizeTournamentDialog({
  open,
  tournamentName,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState("");
  const matches = typed === tournamentName;

  const dialogRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: () => { if (!pending) onCancel(); },
  });

  function handleCancel() {
    if (!pending) { setTyped(""); onCancel(); }
  }

  function handleConfirm() {
    if (matches && !pending) { setTyped(""); onConfirm(); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="finalize-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="finalize-dialog-title"
            aria-describedby="finalize-dialog-desc"
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h2 id="finalize-dialog-title" className="text-xl font-bold">
              Finalizar el torneo
            </h2>
            <p id="finalize-dialog-desc" className="text-text-dim text-sm">
              Esta acción finaliza el torneo. Las partidas en curso quedan como están y no
              se generan más rondas. <strong className="text-text">Esta acción no se puede deshacer.</strong>
            </p>
            <div className="space-y-2">
              <label htmlFor="finalize-confirm-input" className="block text-sm text-text-dim">
                Para confirmar, escribí el nombre exacto del torneo:{" "}
                <strong className="text-text">{tournamentName}</strong>
              </label>
              <input
                id="finalize-confirm-input"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={pending}
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger/50 disabled:opacity-50"
                placeholder={tournamentName}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={handleCancel}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1 bg-danger/90 hover:bg-danger shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={!matches || pending}
                aria-disabled={!matches || pending}
              >
                {pending ? "Finalizando…" : "Finalizar"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
