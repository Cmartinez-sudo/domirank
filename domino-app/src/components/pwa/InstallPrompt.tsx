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
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto md:w-80 z-50 card border-primary/30 flex items-start gap-3 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="inline-grid place-items-center w-10 h-10 rounded-xl text-black text-xs font-extrabold shrink-0"
        style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
        DR
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Instalar DomiRank</p>
        <p className="text-xs text-text-mute mt-0.5">Acceso rapido desde la pantalla de inicio.</p>
        <div className="flex gap-2 mt-3">
          <button onClick={install} className="btn-primary !min-h-0 !py-1.5 !px-3 text-xs">
            Instalar
          </button>
          <button onClick={dismiss} className="btn-ghost !min-h-0 !py-1.5 !px-3 text-xs">
            Ahora no
          </button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Cerrar" className="text-text-mute hover:text-text transition-colors shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
