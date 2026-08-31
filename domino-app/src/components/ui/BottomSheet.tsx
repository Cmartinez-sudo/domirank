"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  labelledById?: string;
};

const DRAG_CLOSE_VELOCITY = 500;
const DRAG_CLOSE_DISTANCE = 120;

export function BottomSheet({ open, onClose, title, children, labelledById }: Props) {
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [0, 300], [1, 0]);
  const focusRef = useFocusTrap<HTMLDivElement>({ enabled: open, onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) y.set(0);
  }, [open, y]);

  if (typeof document === "undefined") return null;

  const headerId = labelledById ?? (title ? "bottomsheet-title" : undefined);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ opacity: backdropOpacity }}
          onClick={onClose}
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}
      {open && (
        <motion.div
          key="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headerId}
          ref={focusRef}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 340 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (info.offset.y > DRAG_CLOSE_DISTANCE || info.velocity.y > DRAG_CLOSE_VELOCITY) {
              onClose();
            }
          }}
          style={{ y, paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full md:max-w-md md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-2xl rounded-t-2xl bg-bg-2 border border-border shadow-2xl flex flex-col max-h-[90vh] focus:outline-none z-[81]"
        >
            <div className="flex justify-center pt-2 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-border-strong opacity-70" aria-hidden="true" />
            </div>

            {title ? (
              <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-border">
                <h2 id={headerId} className="font-semibold text-base">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
                >
                  <XIcon />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors z-10"
              >
                <XIcon />
              </button>
            )}

          <div className="overflow-y-auto p-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
