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

  useEffect(() => {
    setPermission(getNotificationPermission());
    isSubscribed().then(setSubscribed);
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 ${
              subscribed ? "bg-primary" : "bg-surface-3"
            }`}
          >
            <span className="sr-only">{subscribed ? "Desactivar" : "Activar"} notificaciones</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                subscribed ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        )}
      </div>

      {denied && (
        <p className="text-xs text-text-mute">
          Tenés notificaciones bloqueadas. Cambialo desde la configuracion de tu navegador.
        </p>
      )}

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-primary" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      {/* iOS limitation notice */}
      <p className="text-xs text-text-mute mt-1">
        En iPhone/iPad necesitas primero instalar la app a la pantalla de inicio (iOS 16.4+) para recibir notificaciones push.
      </p>
    </div>
  );
}
