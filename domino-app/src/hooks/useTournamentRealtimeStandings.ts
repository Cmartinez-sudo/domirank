"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { LeaderboardRow } from "@/types/leaderboard";

interface UseRealtimeStandingsResult {
  standings: LeaderboardRow[];
  loading: boolean;
  /** Timestamp ISO del último fetch, null si nunca */
  lastUpdated: Date | null;
}

export function useTournamentRealtimeStandings(
  tournamentId: string,
  initial: LeaderboardRow[]
): UseRealtimeStandingsResult {
  const [standings, setStandings] = useState<LeaderboardRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Evita fetch doble si llegan múltiples eventos en ráfaga
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStandings = useCallback(async () => {
    const supabase = supabaseBrowser();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_tournament_standings", {
        p_tournament_id: tournamentId,
      });
      if (error) {
        console.error("[useTournamentRealtimeStandings] RPC error:", error.message);
        return;
      }
      if (data) {
        setStandings(
          (data as LeaderboardRow[]).map((row) => ({
            ...row,
            // Normaliza bigint → number (Supabase puede devolver strings)
            rank: Number(row.rank),
            wins: Number(row.wins),
            losses: Number(row.losses),
            win_pct: Number(row.win_pct),
            pf: Number(row.pf),
            pc: Number(row.pc),
            plus_minus: Number(row.plus_minus),
          }))
        );
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  function scheduleRefetch() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fetchStandings, 800);
  }

  useEffect(() => {
    const supabase = supabaseBrowser();

    const channel = supabase
      .channel(`tournament-standings-${tournamentId}`)
      // Solo escucha matches confirmados → actualizar standings.
      // Los cambios de ronda y status los maneja useTournamentMetaChanges
      // (en TournamentRealtimeRefresher), evitando doble canal.
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status;
          if (newStatus === "confirmed") {
            scheduleRefetch();
          }
        },
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
    // fetchStandings es estable (useCallback con tournamentId)
  }, [tournamentId, fetchStandings]); // eslint-disable-line react-hooks/exhaustive-deps

  return { standings, loading, lastUpdated };
}
