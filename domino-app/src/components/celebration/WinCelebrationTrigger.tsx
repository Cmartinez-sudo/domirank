"use client";

import { useEffect } from "react";
import { useCelebration } from "@/hooks/useCelebration";

/**
 * Fires a "win-rated" celebration burst on mount if the viewer won a
 * confirmed rated match. Dedupes per `matchId` so revisiting the page
 * doesn't re-fire.
 *
 * Renders nothing — pure effect. Belongs on the match detail page so
 * the redirect flow from LiveMatchScreen lands the user directly on a
 * celebrating screen.
 */
export function WinCelebrationTrigger({
  matchId,
  viewerWon,
  hasRating,
}: {
  matchId: string;
  viewerWon: boolean;
  hasRating: boolean;
}) {
  const celebrate = useCelebration();

  useEffect(() => {
    if (!viewerWon || !hasRating) return;
    celebrate("win-rated", { dedupeKey: `win:${matchId}` });
  }, [matchId, viewerWon, hasRating, celebrate]);

  return null;
}
