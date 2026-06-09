import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { VoidMatchButton } from "./VoidMatchButton";
import { AttestationPanel, type AttestationStatus, type AttestPlayer, type Attestation } from "@/components/match/AttestationPanel";
import { SecondaryPageShell } from "@/components/SecondaryPageShell";
import { BACK_FALLBACKS } from "@/lib/back-fallbacks";
import { CancellationUndoBanner } from "@/components/match/CancellationUndoBanner";

export const dynamic = "force-dynamic";

export default async function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  let currentUserId: string | null = null;
  try { const u = await requireUser(); currentUserId = u.id; } catch {}

  const { data: match } = await supabase
    .from("match_feed")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) return notFound();

  // Carga campos extra de matches no expuestos por match_feed
  const { data: matchExtra } = await supabase
    .from("matches")
    .select("scorekeeper_id, finalized_at, confirmed_at, rated_at, set_size, cancelled_at, cancelled_by_user_id, cancellation_reason, cancellation_undo_until")
    .eq("id", id)
    .single();

  // Si la partida está cancelled, fetch del profile de quién canceló
  let cancelledByProfile: { username: string; display_name: string | null } | null = null;
  if (match.status === "cancelled" && matchExtra?.cancelled_by_user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", matchExtra.cancelled_by_user_id)
      .maybeSingle();
    cancelledByProfile = prof as { username: string; display_name: string | null } | null;
  }

  // Viewer is a participant?
  const viewerIsParticipant = currentUserId
    ? ((match.players ?? []) as any[]).some((p) => p.user_id === currentUserId)
    : false;

  const { data: attestationsData } = await supabase
    .from("match_attestations")
    .select("user_id, action, comment, created_at")
    .eq("match_id", id);
  const attestations = (attestationsData ?? []) as Attestation[];

  const teams = new Map<number, any[]>();
  for (const p of (match.players ?? []) as any[]) {
    if (!p?.user_id) continue;
    if (!teams.has(p.team)) teams.set(p.team, []);
    teams.get(p.team)!.push(p);
  }
  const teamList = Array.from(teams.entries()).sort(([a], [b]) => a - b);

  // Players para AttestationPanel
  const players: AttestPlayer[] = ((match.players ?? []) as any[])
    .filter((p) => p?.user_id)
    .map((p) => ({
      user_id:      p.user_id,
      username:     p.username,
      display_name: p.display_name,
      avatar_url:   p.avatar_url ?? null,
    }));

  // Delta de rating Elo del viewer si confirmed
  let viewerDelta: number | null = null;
  if (match.status === "confirmed" && currentUserId) {
    const me = (match.players as any[]).find((p) => p.user_id === currentUserId);
    if (me?.elo_before != null && me?.elo_after != null) {
      viewerDelta = Number(me.elo_after) - Number(me.elo_before);
    }
  }

  const status = match.status as AttestationStatus | "in_progress" | "cancelled";
  const showAttestation = ["pending_attestation", "confirmed", "disputed", "void"].includes(status);
  const isVoid    = status === "void";
  const isCreator = currentUserId && match.created_by === currentUserId;
  const canVoid   = isCreator && status === "confirmed";

  return (
    <SecondaryPageShell title="Partida" fallbackPath={BACK_FALLBACKS.match_detail}>
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-text-mute text-sm">
            {match.format === "singles" ? "Singles" : "Parejas"} · a {match.target_points} pts ·{" "}
            {new Date(match.created_at).toLocaleString("es")}
          </div>
        </div>
        {canVoid && <VoidMatchButton matchId={id} />}
      </div>

      {status === "cancelled" && (
        <CancellationUndoBanner
          matchId={id}
          undoUntilIso={matchExtra?.cancellation_undo_until ?? null}
          cancelledBy={cancelledByProfile}
          cancelledAtIso={matchExtra?.cancelled_at ?? null}
          reason={matchExtra?.cancellation_reason ?? null}
          canUndo={viewerIsParticipant}
        />
      )}

      {showAttestation && currentUserId && (
        <AttestationPanel
          matchId={id}
          status={status as AttestationStatus}
          scorekeeperId={matchExtra?.scorekeeper_id ?? null}
          viewerId={currentUserId}
          players={players}
          attestations={attestations}
          finalizedAt={matchExtra?.finalized_at ?? null}
          ratingDelta={viewerDelta}
        />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {teamList.map(([teamNo, players]) => {
          const score = players[0]?.score ?? 0;
          const won = players[0]?.rank === 1;
          const hasRating = players[0]?.elo_before != null && players[0]?.elo_after != null;
          return (
            <div key={teamNo} className={`card ${won && status === "confirmed" ? "border-primary/50" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Equipo {teamNo}</h2>
                {won && status === "confirmed" && (
                  <span className="badge bg-primary/15 text-primary">Ganador</span>
                )}
                {won && status === "pending_attestation" && (
                  <span className="badge bg-yellow-400/15 text-yellow-400">Ganador (pendiente)</span>
                )}
              </div>
              <div className="text-4xl font-mono font-bold mb-4">{score}</div>
              <ul className="space-y-3">
                {players.map((p) => {
                  const eloDelta = hasRating
                    ? Number(p.elo_after) - Number(p.elo_before)
                    : null;
                  return (
                    <li key={p.user_id} className="flex items-center justify-between text-sm">
                      <Link href={`/profile/${p.username}`} className="hover:text-primary">
                        {p.display_name || p.username}
                      </Link>
                      {hasRating ? (
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-text-mute">{Number(p.elo_before)}</span>
                          <span className="text-text-mute">→</span>
                          <span>{Number(p.elo_after)}</span>
                          <span className={eloDelta! >= 0 ? "text-primary" : "text-danger"}>
                            ({eloDelta! >= 0 ? "+" : ""}{eloDelta!})
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-mute text-xs italic">rating pendiente</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
    </SecondaryPageShell>
  );
}
