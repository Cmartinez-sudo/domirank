"use client";

import { useEffect, useRef } from "react";

/**
 * Modal de confirmación para acciones destructivas (Fase C+D #4 dec. 13).
 *
 * Patrón: descripción explícita de consecuencias antes de confirmar.
 * Cancelar tiene focus por default (defensivo). Botón de acción en rojo.
 *
 * Uso típico:
 *   <ConfirmDangerDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await leaveGroup(...); setOpen(false); }}
 *     title="¿Salir del grupo?"
 *     description="Dejarás de ver el leaderboard y partidas nuevas del grupo. Tu historial se conserva."
 *     confirmLabel="Sí, salir"
 *   />
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel: string;
  /** Texto del botón cancelar. Default: "Cancelar". */
  cancelLabel?: string;
  /** Si true, deshabilita ambos botones (durante la operación async). */
  pending?: boolean;
};

export function ConfirmDangerDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  pending = false,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus inicial en Cancelar.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // ESC cierra (solo si no está pending).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, pending]);

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={() => !pending && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-danger-title"
        aria-describedby="confirm-danger-desc"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[min(420px,90vw)] bg-bg-2 border border-border rounded-2xl shadow-2xl p-5"
      >
        <h2 id="confirm-danger-title" className="text-lg font-bold text-text mb-2">
          {title}
        </h2>
        <p id="confirm-danger-desc" className="text-sm text-text-dim leading-relaxed mb-5">
          {description}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={pending}
            className="px-4 py-2.5 rounded-xl bg-danger text-white font-semibold hover:bg-danger/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {pending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
