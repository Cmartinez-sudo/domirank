"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Si la acción es destructiva (eliminar, anular), tinte rojo en el botón */
  destructive?: boolean;
  /** Loading state mientras corre el onConfirm async */
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Contenido opcional adicional (e.g., textarea para razón) */
  children?: ReactNode;
};

/**
 * Modal de confirmación reusable. Reemplaza `window.confirm()` con un diálogo
 * con focus trap, escape para cerrar, click-outside opcional, y a11y completa.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: () => { if (!pending) onCancel(); },
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            // click sobre el overlay (no sobre el dialog) cierra, salvo durante pending
            if (e.target === e.currentTarget && !pending) onCancel();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-desc" : undefined}
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h2 id="confirm-dialog-title" className="text-xl font-bold">{title}</h2>
            {description && (
              <p id="confirm-dialog-desc" className="text-text-dim text-sm">
                {description}
              </p>
            )}
            {children}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={onCancel}
                disabled={pending}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`btn-primary flex-1 ${destructive ? "bg-danger/90 hover:bg-danger shadow-none" : ""}`}
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? "…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook helper para usar ConfirmDialog con menos boilerplate.
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "¿Estás seguro?", destructive: true });
 *   if (ok) doDestructiveThing();
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    destructive?: boolean;
    resolve?: (ok: boolean) => void;
  }>({ open: false, title: "" });

  function ask(opts: { title: string; description?: string; confirmLabel?: string; destructive?: boolean }): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ ...opts, open: true, resolve });
    });
  }

  function close(ok: boolean) {
    state.resolve?.(ok);
    setState((s) => ({ ...s, open: false, resolve: undefined }));
  }

  const node = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { ask, node };
}
