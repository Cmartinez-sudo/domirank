"use client";

import { useEffect, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const VISIT_KEY   = "domirank_visit_count";
const DISMISS_KEY = "domirank_ios_install_dismissed";

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  // Since iPadOS 13, iPads report "MacIntel" with a touch-capable navigator
  // by default. The UA regex alone misses them.
  const ua = navigator.userAgent;
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (isClassicIOS || isIPadOS13Plus) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

export function IOSInstallInstructions() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    if (isStandalone()) return;

    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0", 10);
    if (visits < 2) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  const dialogRef = useFocusTrap<HTMLDivElement>({
    enabled: visible,
    onEscape: dismiss,
  });

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-slide-up-fade"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        tabIndex={-1}
        className="card w-full max-w-sm space-y-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <h2 id="ios-install-title" className="text-base font-semibold">Instalar DomiRank</h2>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="-m-1.5 p-1.5 rounded-md text-text-mute hover:text-text hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="text-sm text-text-mute">
          Para instalar DomiRank en tu iPhone o iPad, seguí estos pasos:
        </p>

        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">1</span>
            <p className="text-sm flex-1">
              Tocá el botón
              <span className="inline-flex items-center align-middle mx-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-label="ícono Compartir">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span>
              Compartir en Safari.
            </p>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">2</span>
            <p className="text-sm flex-1">Desplazate y tocá <strong>Agregar a pantalla de inicio</strong>.</p>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">3</span>
            <p className="text-sm flex-1">Tocá <strong>Agregar</strong> en la esquina superior derecha.</p>
          </li>
        </ol>

        <p className="text-xs text-text-mute">
          Requiere iOS 16.4+ para recibir notificaciones push.
        </p>

        <button onClick={dismiss} className="btn-ghost w-full text-sm">
          Entendido
        </button>
      </div>
    </div>
  );
}
