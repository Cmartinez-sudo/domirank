"use client";

/**
 * ContinuousLeagueRealtimeRefresher
 *
 * F2.6 — Suscribe a UPDATEs en `matches` filtrados por tournament_id.
 * Cuando un match cambia (típicamente: in_progress → confirmed al
 * finalizar), llama router.refresh() para que el Server Component padre
 * re-ejecute sus queries y ambos leaderboards (Global + Daily) se
 * refresquen — incluyendo el badge "Rey del día" si cambia el winner.
 *
 * Side-effect rider; no renderiza nada visible.
 *
 * Diferente de TournamentRealtimeRefresher (escucha cambios de meta del
 * torneo) — este escucha cambios de MATCHES del torneo.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Props = {
  tournamentId: string;
};

export function ContinuousLeagueRealtimeRefresher({ tournamentId }: Props) {
  const router = useRouter();
  // Debounce: si llegan varios UPDATEs en ráfaga (e.g., match_rounds + match
  // status + scorekeeper_id), refrescamos una sola vez al final.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.refresh();
        timerRef.current = null;
      }, 250);
    };

    const channel = supabase
      .channel(`continuous-league:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  return null;
}
