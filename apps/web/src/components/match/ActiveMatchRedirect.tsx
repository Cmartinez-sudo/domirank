"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveMatch } from "@/hooks/useActiveMatch";

type Props = {
  userId: string | null;
};

/**
 * Smart redirect — Spec C7.
 *
 * Si el viewer tiene partida activa, navega a /matches/[id]/live una vez
 * por sesión (sessionStorage flag persiste el "ya redirigí a match X").
 *
 * Exceptions (never redirect):
 *   • /matches/[id]/...  (cualquier match — incluye history)
 *   • /onboarding
 *   • /login, /signup, /reset-password, /forgot-password, /auth/*
 *   • Deep links con ?from=…
 *
 * Spectators no están en match_players → useActiveMatch retorna null →
 * no redirect.
 *
 * NOTA: Antes usaba `useSearchParams()` pero Next 14 lo requiere envuelto
 * en <Suspense> y sin eso crashea con "parallelRoutes.get null" en
 * producción. Leemos la query string desde window.location.search dentro
 * del effect (client-only).
 */
export function ActiveMatchRedirect({ userId }: Props) {
  const { activeMatch } = useActiveMatch(userId);
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (!activeMatch || !userId) return;
    if (typeof window === "undefined") return;

    const search = new URLSearchParams(window.location.search);
    if (shouldSkipRedirect(pathname, search)) return;

    const sessionKey = `active-match-redirected:${activeMatch.match_id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");
    // in_progress → /live (seguir scoreando)
    // pending_attestation (ya hay ganador, falta firma) → /matches/[id]
    //   donde vive el AttestationPanel.
    const dest = activeMatch.status === "pending_attestation"
      ? `/matches/${activeMatch.match_id}`
      : `/matches/${activeMatch.match_id}/live`;
    router.replace(dest);
  }, [activeMatch?.match_id, activeMatch?.status, pathname, router, userId]);

  return null;
}

function shouldSkipRedirect(
  pathname: string,
  search: URLSearchParams,
): boolean {
  if (pathname.startsWith("/matches/")) return true;
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (search.has("from")) return true;
  return false;
}
