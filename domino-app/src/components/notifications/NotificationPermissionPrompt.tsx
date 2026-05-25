"use client";

import { useEffect, useState } from "react";
import { getNotificationPermission, subscribeToPush } from "@/lib/push-client";

const STORAGE_KEY = "domirank_push_prompted";

interface Props {
  /** Total de partidas confirmadas del usuario — viene del server component padre */
  confirmedMatchesCount: number;
}

export function NotificationPermissionPrompt({ confirmedMatchesCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (confirmedMatchesCount < 1) return;
    if (getNotificationPermission() !== "default") return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, [confirmedMatchesCount]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setVisible(false);
  }

  async function activate() {
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) {
      localStorage.setItem(STORAGE_KEY, "activated");
      setVisible(false);
    } else if (result.error === "Permission not granted.") {
      // User actively denied — don't nag them again. Browser permission
      // is sticky; re-prompting will just no-op.
      localStorage.setItem(STORAGE_KEY, "denied");
      setVisible(false);
    }
    // For other errors (VAPID misconfig, server down) keep the prompt
    // visible so the user can retry. The toggle in /settings is the fallback.
  }

  if (!visible) return null;

  return (
    <section
      role="region"
      aria-label="Activar notificaciones"
      className="card border-primary/30 bg-surface flex items-start gap-3 mb-4 animate-slide-up-fade"
    >
      <div className="mt-0.5 text-primary shrink-0" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Activa las notificaciones</p>
        <p className="text-xs text-text-mute mt-0.5">
          No pierdas partidas pendientes de tu firma. Te avisamos cuando necesitas actuar.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={activate}
            disabled={busy}
            aria-busy={busy}
            className="btn-primary min-h-[40px] py-1.5 px-3.5 text-xs disabled:opacity-60"
          >
            {busy && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="animate-spin-fast"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
            )}
            {busy ? "Activando…" : "Activar"}
          </button>
          <button
            onClick={dismiss}
            disabled={busy}
            className="btn-ghost min-h-[40px] py-1.5 px-3.5 text-xs"
          >
            Ahora no
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 -m-1.5 p-1.5 rounded-md text-text-mute hover:text-text hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </section>
  );
}
