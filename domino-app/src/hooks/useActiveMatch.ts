"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type ActiveMatch = {
  match_id: string;
  status: "in_progress" | "pending_attestation";
  format: string;
  target_points: number;
  created_at: string;
  created_by: string;
  current_score_keeper_id: string | null;
  tournament_id: string | null;
};

/**
 * Returns the user's currently active match (0 or 1 row, enforced by
 * trigger trg_one_active_match), keeps it fresh via a postgres_changes
 * realtime subscription on match_rounds (so the chip score updates
 * in near-realtime) and matches.status (so when the match ends, the
 * chip disappears).
 */
export function useActiveMatch(userId: string | null) {
  // Stable ID per hook instance — multiple components (ActiveMatchRedirect,
  // ActiveMatchChip, …) call this hook con el mismo userId, lo que provocaba
  // colisión de channel names en Supabase realtime ("cannot add callbacks
  // after subscribe()"). useId() garantiza names únicos por instancia.
  const instanceId = useId();
  const [data, setData] = useState<ActiveMatch | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));

  const refetch = useCallback(async () => {
    if (!userId) {
      setData(null);
      setScoreA(0);
      setScoreB(0);
      setLoading(false);
      return;
    }
    const supabase = supabaseBrowser();
    const { data: row } = await supabase
      .from("active_matches_per_user")
      .select("match_id, status, format, target_points, created_at, created_by, current_score_keeper_id, tournament_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setData(row as ActiveMatch | null);
    setLoading(false);

    if (row?.match_id) {
      const { data: rounds } = await supabase
        .from("match_rounds")
        .select("team, points")
        .eq("match_id", row.match_id);
      const a = (rounds ?? []).filter((r: any) => r.team === 1).reduce((s, r: any) => s + (r.points ?? 0), 0);
      const b = (rounds ?? []).filter((r: any) => r.team === 2).reduce((s, r: any) => s + (r.points ?? 0), 0);
      setScoreA(a);
      setScoreB(b);
    }
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime: re-fetch when a hand is added to the active match OR
  // when the match's status changes.
  useEffect(() => {
    if (!userId || !data?.match_id) return;
    const supabase = supabaseBrowser();
    // Channel name = instanceId + match_id → único por (hook instance × match).
    // useId genera "::r1::" o similar; lo sanitizamos para evitar caracteres
    // problemáticos en el channel name.
    const safeInstance = instanceId.replace(/[^a-zA-Z0-9-]/g, "");
    const channel = supabase
      .channel(`active-match-${safeInstance}-${data.match_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_rounds", filter: `match_id=eq.${data.match_id}` },
        () => { refetch(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${data.match_id}` },
        () => { refetch(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, data?.match_id, refetch, instanceId]);

  return { activeMatch: data, scoreA, scoreB, loading, refetch };
}
