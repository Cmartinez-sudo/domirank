"use client";

// Sprint 1c (S5): banner persistente para usuarios legacy (onboarding_version < 2)
// que aún no han pasado por el flujo v2. Skippable por sesión, pero
// vuelve a aparecer en el próximo login (Regla 6: return sin repetir, pero
// aceptamos el prompt como recordatorio suave).

import Link from "next/link";
import { useEffect, useState } from "react";
import { analytics } from "@/lib/analytics";

const DISMISS_KEY = "domirank:legacy_reonboarding_dismissed";

export function LegacyReonboardingBanner() {
  const [dismissed, setDismissed] = useState(true); // hidden hasta hydration

  useEffect(() => {
    const flag = sessionStorage.getItem(DISMISS_KEY);
    setDismissed(!!flag);
    if (!flag) {
      analytics.track("legacy_reonboarding_banner_shown", {});
    }
  }, []);

  if (dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      className="card border-primary/40 bg-primary/5"
      role="region"
      aria-label="Actualización de onboarding"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">✨</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Actualizamos el onboarding</div>
          <p className="text-text-mute text-sm mt-0.5">
            30 segundos para completar tu perfil con los nuevos datos (foto,
            fecha nacimiento si aplica).
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Link
              href="/onboarding?mode=migration"
              className="btn-primary !min-h-0 !py-1.5 !px-3 text-sm"
              onClick={() => analytics.track("legacy_reonboarding_started", {})}
            >
              Sí, vamos
            </Link>
            <button
              type="button"
              className="btn-ghost !min-h-0 !py-1.5 !px-3 text-sm text-text-mute"
              onClick={handleDismiss}
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
