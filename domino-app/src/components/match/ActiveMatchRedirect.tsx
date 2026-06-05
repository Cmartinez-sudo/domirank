"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActiveMatch } from "@/hooks/useActiveMatch";

type Props = {
  userId: string | null;
};

/**
 * Smart redirect — Spec C7.
 *
 * If the user has an active match, auto-navigate to it ONCE per session.
 * sessionStorage flag persists the "I already redirected to match X"
 * decision so the user can hit back / navigate freely without being
 * teleported again until they close the tab.
 *
 * Exceptions (never redirect):
 *   • /matches/[id]/...  (any match route — they may be checking history)
 *   • /onboarding
 *   • /login, /signup, /reset-password, /forgot-password
 *   • Deep links (?from=external or ?from=push)
 *
 * Spectators are not in match_players → useActiveMatch returns null → no
 * redirect for them (correct per spec).
 *
 * This is a client-only component intended to be mounted once near the
 * top of the authenticated layout.
 */
export function ActiveMatchRedirect({ userId }: Props) {
  const { activeMatch } = useActiveMatch(userId);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    if (!activeMatch || !userId) return;
    if (typeof window === "undefined") return;

    if (shouldSkipRedirect(pathname, search)) return;

    const sessionKey = `active-match-redirected:${activeMatch.match_id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");
    router.replace(`/matches/${activeMatch.match_id}/live`);
  }, [activeMatch?.match_id, pathname, search, router, userId]);

  return null;
}

function shouldSkipRedirect(
  pathname: string,
  search: URLSearchParams | null,
): boolean {
  if (pathname.startsWith("/matches/")) return true;
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (search?.has("from")) return true;
  return false;
}
