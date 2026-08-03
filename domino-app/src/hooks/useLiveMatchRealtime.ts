"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Suscribe la pantalla live a cambios en match_rounds del partido dado y
 * llama router.refresh() cuando otro jugador anota/edita/borra una mano.
 *
 * Necesario desde mig 0104: cualquier match_player puede anotar (no solo
 * un score-keeper), así que dos personas en la misma mesa pueden estar
 * viendo la pantalla al mismo tiempo. Sin realtime, el otro ve estado
 * viejo y puede duplicar anotaciones o creer que no se guardó.
 *
 * Debounce corto (250ms) para agrupar ráfagas de INSERT + UPDATE seguidas
 * (ej: syncMatchScores dispara UPDATE a match_players después de un
 * INSERT a match_rounds; ambos eventos disparan un refresh que colapsamos
 * en uno solo).
 */
export function useLiveMatchRealtime(matchId: string, enabled: boolean = true) {
  const router = useRouter();
  const instanceId = useId();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !matchId) return;

    const supabase = supabaseBrowser();
    const safeInstance = instanceId.replace(/[^a-zA-Z0-9-]/g, "");

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.refresh();
        timerRef.current = null;
      }, 250);
    };

    const channel = supabase
      .channel(`live-match-${safeInstance}-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_rounds", filter: `match_id=eq.${matchId}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [matchId, enabled, router, instanceId]);
}
