"use client";

import { useEffect, useState } from "react";

const VISIT_KEY   = "domirank_visit_count";
const SESSION_KEY = "domirank_visit_counted";
const DISMISS_KEY = "domirank_install_dismissed";

// BeforeInstallPromptEvent is not in the standard TS lib yet
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Increment visit count, but only once per browser session. Without this
    // a single user could rack up 5+ visits in a row just by reloading.
    let visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0", 10);
    if (!sessionStorage.getItem(SESSION_KEY)) {
      visits += 1;
      localStorage.setItem(VISIT_KEY, String(visits));
      sessionStorage.setItem(SESSION_KEY, "1");
    }

    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show on first visit
    if (visits < 2) return;

    // Don't show if user already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!promptEvent) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setVisible(false);
    } finally {
      setInstalling(false);
      setPromptEvent(null);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      role="region"
      aria-label="Instalar DomiRank en pantalla de inicio"
      className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto md:w-80 z-50 card border-primary/30 flex items-start gap-3 shadow-pop animate-slide-up-fade"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="inline-grid place-items-center w-10 h-10 rounded-xl text-white text-xs font-extrabold shrink-0"
        style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
        aria-hidden="true"
      >
        DR
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Instalar DomiRank</p>
        <p className="text-xs text-text-mute mt-0.5">Acceso rápido desde la pantalla de inicio.</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={install}
            disabled={installing}
            aria-busy={installing}
            className="btn-primary min-h-[40px] py-1.5 px-3.5 text-xs disabled:opacity-60"
          >
            {installing && (
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
            {installing ? "Instalando…" : "Instalar"}
          </button>
          <button
            onClick={dismiss}
            disabled={installing}
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
