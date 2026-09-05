"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { analytics } from "@/lib/analytics";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * Cookie consent banner (analytics-only). Blocks PostHog until the user
 * makes an explicit choice. The "Rechazar" and "Aceptar" buttons have equal
 * visual weight — this is intentional to avoid dark-pattern nudging.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostrar sólo si el usuario aún no ha decidido.
    setVisible(getConsent() === null);
  }, []);

  function accept() {
    setConsent("accepted");
    setVisible(false);
    // El listener en AnalyticsProvider re-inicializa PostHog. Como fallback,
    // llamamos init aquí directamente.
    try {
      analytics.init();
    } catch {}
  }

  function reject() {
    setConsent("rejected");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-3xl mx-auto rounded-2xl border border-border bg-surface-2/95 backdrop-blur shadow-pop p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
          <p className="text-sm text-text-dim leading-relaxed flex-1">
            Usamos cookies estrictamente necesarias para tu sesión y, si lo
            aceptas, analítica (PostHog) para entender qué funciones se usan
            más. No compartimos tus datos con anunciantes. Más detalles en{" "}
            <Link href="/privacy" className="text-primary underline">
              Política de privacidad
            </Link>
            .
          </p>
          <div
            className="flex gap-2 shrink-0 w-full sm:w-auto"
            role="group"
            aria-label="Preferencias de cookies"
          >
            <button
              type="button"
              onClick={reject}
              className="btn flex-1 sm:flex-none border border-border hover:border-text-mute text-text-dim hover:text-text"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={accept}
              className="btn-primary flex-1 sm:flex-none"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
