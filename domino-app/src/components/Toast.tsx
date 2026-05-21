"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: string; kind: ToastKind; text: string };

type ToastApi = {
  show: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Si no hay provider, devolver un no-op silencioso para que el componente
    // no rompa en tests/storybook. En producción debería siempre haber provider.
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const api: ToastApi = {
    show,
    success: (t) => show(t, "success"),
    error:   (t) => show(t, "error"),
    info:    (t) => show(t, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[60] left-0 right-0 px-4 pointer-events-none flex flex-col items-center gap-2"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="pointer-events-auto max-w-sm w-full"
            >
              <div
                role="status"
                aria-live="polite"
                className={`px-4 py-3 rounded-xl border shadow-lg text-sm font-medium backdrop-blur-xl ${
                  t.kind === "success"
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : t.kind === "error"
                    ? "bg-danger/15 border-danger/40 text-danger"
                    : "bg-surface/95 border-border text-text"
                }`}
                onClick={() => dismiss(t.id)}
              >
                {t.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
