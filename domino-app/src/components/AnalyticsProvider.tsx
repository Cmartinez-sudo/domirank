"use client";

import { useEffect, useRef } from "react";
import { analytics } from "@/lib/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { User } from "@supabase/supabase-js";

type Props = {
  user: User | null;
  profile?: { username?: string | null; country?: string | null } | null;
  children: React.ReactNode;
};

export function AnalyticsProvider({ user, profile, children }: Props) {
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    analytics.init();
    // Si el usuario acepta el banner después del primer render, re-inicializar.
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "accepted") analytics.init();
    };
    window.addEventListener("domirank:consent-changed", onConsent);
    return () => window.removeEventListener("domirank:consent-changed", onConsent);
  }, []);

  useEffect(() => {
    if (user) {
      analytics.identify(user.id, {
        email: user.email ?? undefined,
        username: profile?.username ?? undefined,
        country: profile?.country ?? undefined,
      });
      prevUserIdRef.current = user.id;
    } else if (prevUserIdRef.current !== null) {
      // Transición de user -> null: logout
      analytics.reset();
      prevUserIdRef.current = null;
    }
    // Si user es null desde el primer render (visitante anónimo), no llama reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, profile?.username, profile?.country]);

  return (
    <>
      {children}
      <SpeedInsights />
    </>
  );
}
