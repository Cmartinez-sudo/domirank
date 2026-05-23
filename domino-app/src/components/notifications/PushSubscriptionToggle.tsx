"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPermission,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

export function PushSubscriptionToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
    isSubscribed().then(setSubscribed);

    const ua = navigator.userAgent;
    const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS13Plus =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    setIsIOS((isClassicIOS || isIPadOS13Plus) && !(window as { MSStream?: unknown }).MSStream);
  }, []);

  async function toggle() {
    setMessage(null);
    setBusy(true);
    try {
      if (subscribed) {
        const result = await unsubscribeFromPush();
        if (result.ok) {
          setSubscribed(false);
          setMessage({ kind: "ok", text: "Notificaciones desactivadas." });
        } else {
          setMessage({ kind: "error", text: result.error });
        }
      } else {
        const result = await subscribeToPush();
        if (result.ok) {
          setSubscribed(true);
          setPermission(getNotificationPermission());
          setMessage({ kind: "ok", text: "Notificaciones activadas." });
        } else {
          setMessage({ kind: "error", text: result.error });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (permission === "loading") {
    return null;
  }

  if (permission === "unsupported") {
    return (
      <div className="text-sm text-text-mute">
        Tu navegador no soporta notificaciones push.
      </div>
    );
  }

  const denied = permission === "denied";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Notificaciones push</div>
          <div className="text-xs text-text-mute mt-0.5">
            Recibí alertas de partidas, atestados y torneos.
          </div>
        </div>

        {denied ? (
          <span className="text-xs text-text-mute">Bloqueadas</span>
        ) : (
          <button
            onClick={toggle}
            disabled={busy}
            aria-pressed={subscribed}
            aria-busy={busy}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 ${
              subscribed ? "bg-primary" : "bg-surface-3"
            } before:absolute before:inset-0 before:-m-2 before:content-['']`}
          >
            <span className="sr-only">
              {busy ? "Procesando" : subscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
            </span>
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="animate-spin-fast text-white"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
              </span>
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  subscribed ? "translate-x-6" : "translate-x-1"
                }`}
              />
            )}
          </button>
        )}
      </div>

      {denied && (
        <p className="text-xs text-text-mute">
          Tenés notificaciones bloqueadas. Cambialo desde la configuracion de tu navegador.
        </p>
      )}

      {message && (
        <p
          className={`text-xs ${message.kind === "ok" ? "text-primary" : "text-danger"}`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </p>
      )}

      {isIOS && (
        <p className="text-xs text-text-mute mt-1">
          En iPhone/iPad necesitás primero instalar la app a la pantalla de inicio (iOS 16.4+) para recibir notificaciones push.
        </p>
      )}
    </div>
  );
}
