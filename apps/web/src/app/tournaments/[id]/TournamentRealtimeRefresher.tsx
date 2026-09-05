"use client";

/**
 * TournamentRealtimeRefresher
 *
 * Client Component que escucha cambios de ronda y status del torneo
 * mediante useTournamentMetaChanges (canal dedicado, sin fetch de standings).
 * Cuando detecta un cambio llama a router.refresh() para que el Server
 * Component padre re-ejecute sus queries.
 *
 * El componente no renderiza nada visible; es un "side-effect rider".
 * TournamentLeaderboard gestiona su propio canal de standings por separado
 * (useTournamentRealtimeStandings), evitando doble canal y doble fetch.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTournamentMetaChanges } from "@/hooks/useTournamentMetaChanges";

export function TournamentRealtimeRefresher({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const router = useRouter();
  const { tournamentChanged } = useTournamentMetaChanges(tournamentId);
  const prevChanged = useRef(false);

  useEffect(() => {
    // Solo hacer refresh cuando la flag pasa de false a true
    if (tournamentChanged && !prevChanged.current) {
      router.refresh();
    }
    prevChanged.current = tournamentChanged;
  }, [tournamentChanged, router]);

  return null;
}
