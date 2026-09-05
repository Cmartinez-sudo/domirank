"use client";

/**
 * useTournamentMetaChanges
 *
 * Hook liviano que escucha únicamente:
 *   - INSERT en tournament_pairings (nueva ronda generada)
 *   - UPDATE en tournaments (status o current_round cambió)
 *
 * NO hace fetch de standings — eso es responsabilidad de
 * useTournamentRealtimeStandings.
 *
 * Expone `tournamentChanged: boolean` para que el consumidor
 * (TournamentRealtimeRefresher) llame router.refresh() cuando sea true.
 *
 * Propósito del split: evitar doble canal + doble fetch cuando tanto
 * TournamentRealtimeRefresher como TournamentLeaderboard montan el hook
 * original en la misma página.
 */

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useTournamentMetaChanges(tournamentId: string): {
  tournamentChanged: boolean;
} {
  const [tournamentChanged, setTournamentChanged] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const channel = supabase
      .channel(`tournament-meta-${tournamentId}`)
      // Nueva ronda generada
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tournament_pairings",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          setTournamentChanged(true);
        },
      )
      // Cambio de status o current_round del torneo
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          const prev = payload.old as { status?: string; current_round?: number };
          const next = payload.new as { status?: string; current_round?: number };
          if (prev.status !== next.status || prev.current_round !== next.current_round) {
            setTournamentChanged(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return { tournamentChanged };
}
