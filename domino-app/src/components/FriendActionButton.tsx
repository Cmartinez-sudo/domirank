"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  unfriend,
  type RelationStatus,
} from "@/lib/friends";
import { useToast } from "@/components/Toast";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const ICON = {
  userPlus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  userCheck: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

export function FriendActionButton({
  targetUserId,
  targetUsername,
  initialStatus,
}: {
  targetUserId: string;
  targetUsername: string;
  initialStatus: RelationStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<RelationStatus>(initialStatus);
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // No renderizar nada en tu propio perfil
  if (status.kind === "self") return null;

  async function runAction(
    optimisticStatus: RelationStatus,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successMsg: string
  ) {
    const previousStatus = status;
    setStatus(optimisticStatus);
    setPending(true);
    const r = await action();
    setPending(false);
    if (!r.ok) {
      setStatus(previousStatus);
      toast.error(r.error);
      return;
    }
    toast.success(successMsg);
    router.refresh();
  }

  function onAdd() {
    runAction(
      { kind: "outgoing_pending", requestId: "optimistic" },
      () => sendFriendRequest(targetUserId),
      `Solicitud enviada a @${targetUsername}`
    );
  }

  function onCancel() {
    if (status.kind !== "outgoing_pending") return;
    runAction(
      { kind: "none" },
      () => cancelFriendRequest(status.requestId),
      "Solicitud cancelada"
    );
  }

  function onAccept() {
    if (status.kind !== "incoming_pending") return;
    runAction(
      { kind: "friends" },
      () => acceptFriendRequest(status.requestId),
      `Ahora son amigos`
    );
  }

  function onReject() {
    if (status.kind !== "incoming_pending") return;
    runAction(
      { kind: "none" },
      () => rejectFriendRequest(status.requestId),
      "Solicitud rechazada"
    );
  }

  function onUnfriend() {
    setConfirmOpen(false);
    setMenuOpen(false);
    runAction(
      { kind: "none" },
      () => unfriend(targetUserId),
      `Ya no son amigos`
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.kind}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: EASE_OUT }}
      >
        {status.kind === "none" && (
          <button
            type="button"
            onClick={onAdd}
            disabled={pending}
            className="btn-primary w-full md:w-auto flex items-center justify-center gap-2"
          >
            {ICON.userPlus} {pending ? "Enviando…" : "Agregar amigo"}
          </button>
        )}

        {status.kind === "outgoing_pending" && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
            <div className="btn-ghost cursor-default flex items-center justify-center gap-2 text-text-dim">
              {ICON.clock} Solicitud enviada
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="text-text-mute text-sm hover:text-danger underline-offset-2 hover:underline px-2"
            >
              Cancelar
            </button>
          </div>
        )}

        {status.kind === "incoming_pending" && (
          <div className="space-y-2">
            <div className="text-xs text-text-mute text-center md:text-left">
              @{targetUsername} quiere ser tu amigo
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={pending}
                className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2"
              >
                {ICON.check} {pending ? "…" : "Aceptar"}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={pending}
                className="btn-ghost flex-1 md:flex-none text-text-mute hover:text-danger flex items-center justify-center gap-2"
              >
                {ICON.x} Rechazar
              </button>
            </div>
          </div>
        )}

        {status.kind === "friends" && (
          <div className="relative inline-block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={pending}
              className="btn-ghost flex items-center justify-center gap-2 text-primary border-primary/40"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              {ICON.userCheck} Amigos {ICON.chevronDown}
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  role="menu"
                  className="absolute right-0 top-full mt-1 min-w-[180px] bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20"
                >
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                    className="w-full text-left px-4 py-3 text-sm text-danger hover:bg-danger/10 transition-colors"
                    role="menuitem"
                  >
                    Quitar de amigos
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl">
              <h2 className="text-xl font-bold">¿Quitar a @{targetUsername} de tus amigos?</h2>
              <p className="text-text-dim text-sm">
                No podrán crear partidas ni torneos juntos hasta que vuelvan a ser amigos.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => setConfirmOpen(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 bg-danger/90 hover:bg-danger shadow-none"
                  onClick={onUnfriend}
                  disabled={pending}
                >
                  Sí, quitar
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
