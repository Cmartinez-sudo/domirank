import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { NR_THRESHOLD, isRated } from "@/lib/rating";
import { TierBadge, RatingInfoTooltip } from "@/components/RatingInfo";
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";
import { FriendActionButton } from "@/components/FriendActionButton";
import { getRelationStatus, type RelationStatus } from "@/lib/friends";
import { SecondaryPageShell } from "@/components/SecondaryPageShell";
import { BACK_FALLBACKS } from "@/lib/back-fallbacks";
import { RemoveFriendAction } from "./RemoveFriendAction";
import { ModalityCard } from "@/components/ModalityCard";
import { buildModalities, getVisibleModalities } from "@/lib/profile";
import { computePartnerRivalStats, type HistoryRow } from "@/lib/profile-stats";

export const dynamic = "force-dynamic";

export default async function PublicProfile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await supabaseServer();

  const { data: profile } = await supabase
    .from("profile_ratings")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) return notFound();

  const p = profile as any;
  const rated = isRated(p);
  const remainingToRated = Math.max(0, NR_THRESHOLD - (p.total_games ?? 0));
  // global_display comes from profile_ratings view (SQL authoritative source).
  const globalDisplay = Number.isFinite(Number(p.global_display)) ? Number(p.global_display) : 1;

  // Defensiva: si falla cualquiera de estas queries, no romper la página
  let relation: RelationStatus = { kind: "none" };
  try {
    relation = await getRelationStatus(p.id);
  } catch (e) {
    console.error("[profile] getRelationStatus failed:", e);
  }

  let isOwnProfile = false;
  try {
    const { data: { user: viewer } } = await supabase.auth.getUser();
    isOwnProfile = viewer?.id === p.id;
  } catch (e) {
    console.error("[profile] getUser failed:", e);
  }

  let history: any[] = [];
  let favoritePartner: { name: string; games: number; wins: number; losses: number } | null = null;
  let toughestRival:   { name: string; games: number; my_wins: number; my_losses: number } | null = null;

  try {
    // Fetch history con los OTHER match_players (team, user_id, profiles) para
    // poder armar el matchup completo y computar pareja favorita + rival principal.
    const { data: historyRaw } = await supabase
      .from("match_players")
      .select(`
        match_id, team, rank, elo_before, elo_after, created_at,
        matches(
          id, format, target_points, status,
          match_players(team, user_id, score, profiles(username, display_name))
        )
      `)
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const allRows = ((historyRaw ?? []) as any[]).filter((r) => {
      const st = r.matches?.status;
      if (isOwnProfile) return ["confirmed","pending_attestation","disputed","void"].includes(st);
      return st === "confirmed";
    }) as HistoryRow[];

    // Render: 20 más recientes
    history = allRows.slice(0, 20);

    // Pareja favorita + rival principal via helper
    const { favoritePartner: fp, toughestRival: tr } = computePartnerRivalStats(allRows, p.id);
    favoritePartner = fp ? { name: fp.name, games: fp.games, wins: fp.wins, losses: fp.losses } : null;
    toughestRival   = tr ? { name: tr.name, games: tr.games, my_wins: tr.my_wins, my_losses: tr.my_losses } : null;
  } catch (e) {
    console.error("[profile] history failed:", e);
  }

  return (
    <SecondaryPageShell
      title={p.display_name || p.username}
      fallbackPath={isOwnProfile ? "/dashboard" : BACK_FALLBACKS.profile}
    >
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Avatar player={p} size={72} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight break-words line-clamp-2">{p.display_name || p.username}</h1>
              <p className="text-text-mute truncate">@{p.username}</p>
              {p.bio && (
                <p className="text-text-dim text-sm mt-1 max-w-xs line-clamp-3">{p.bio}</p>
              )}
              <div className="mt-3 md:hidden">
                <FriendActionButton
                  targetUserId={p.id}
                  targetUsername={p.username}
                  initialStatus={relation}
                />
              </div>
            </div>
            <div className="hidden md:block">
              <FriendActionButton
                targetUserId={p.id}
                targetUsername={p.username}
                initialStatus={relation}
              />
            </div>
          </div>
          <div className="text-center w-full md:w-auto">
            <div className="flex items-center justify-center gap-2">
              <div className="text-text-mute text-xs uppercase tracking-wider">DomiRank Global</div>
              <RatingInfoTooltip />
            </div>
            {rated ? (
              <>
                <div
                  className="font-mono font-extrabold tabular-nums mt-1"
                  style={{
                    fontSize: "2.75rem",
                    lineHeight: 1,
                    backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {globalDisplay.toFixed(1)}
                </div>
                <div className="flex justify-center gap-2 items-center mt-2 flex-wrap">
                  <TierBadge display={globalDisplay} />
                  <ReliabilityBadge
                    score={p.reliability_score ?? 0}
                    showScore
                    factors={{
                      volume:      p.reliability_volume,
                      recency:     p.reliability_recency,
                      attestation: p.reliability_attestation,
                      diversity:   p.reliability_diversity,
                    }}
                    updatedAt={p.reliability_updated_at}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <span
                  className="font-mono font-extrabold text-text-mute"
                  style={{ fontSize: "2.75rem", lineHeight: 1 }}
                >
                  NR
                </span>
                <span className="inline-flex items-center bg-amber-400/15 text-amber-400 text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full">
                  Calibrando
                </span>
              </div>
            )}
            <div className="text-text-mute text-xs mt-2">
              {p.total_games} {p.total_games === 1 ? "partida" : "partidas"} totales
              {!rated && remainingToRated > 0 && (
                ` · faltan ${remainingToRated} para activar tu rating`
              )}
            </div>
          </div>
        </div>

        {(() => {
          const modalities = buildModalities(p);
          const visible = getVisibleModalities(modalities, isOwnProfile);
          if (visible.length === 0) {
            // Vista pública de un user sin partidas: mensaje neutro, no grid vacío.
            return (
              <p className="text-text-mute text-sm mt-6">
                Este jugador aún no ha registrado partidas confirmadas.
              </p>
            );
          }
          return (
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              {visible.map((m) => (
                <ModalityCard key={m.key} modality={m} isOwnView={isOwnProfile} />
              ))}
            </div>
          );
        })()}
      </div>

      {relation.kind === "friends" && !isOwnProfile && (
        <div className="flex justify-end pt-2">
          <RemoveFriendAction
            targetUserId={p.id}
            displayName={p.display_name || p.username}
          />
        </div>
      )}

      {/* Pareja favorita + Rival principal — solo si hay datos */}
      {(favoritePartner || toughestRival) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {favoritePartner && (
            <div className="card">
              <div className="text-text-mute text-[10px] uppercase tracking-[0.12em] font-semibold mb-1">Pareja favorita</div>
              <div className="font-bold text-base truncate">{favoritePartner.name}</div>
              <div className="text-text-dim text-xs mt-1 tabular-nums">
                {favoritePartner.games} {favoritePartner.games === 1 ? "partida" : "partidas"} juntos · {favoritePartner.wins}V-{favoritePartner.losses}D
              </div>
            </div>
          )}
          {toughestRival && (
            <div className="card">
              <div className="text-text-mute text-[10px] uppercase tracking-[0.12em] font-semibold mb-1">Rival más fuerte</div>
              <div className="font-bold text-base truncate">{toughestRival.name}</div>
              <div className="text-text-dim text-xs mt-1 tabular-nums">
                {toughestRival.games} {toughestRival.games === 1 ? "partida" : "partidas"} en contra · {toughestRival.my_wins}V-{toughestRival.my_losses}D
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Historial reciente</h2>
        {history && history.length > 0 ? (
          <ul className="divide-y divide-border">
            {history.map((r: any) => {
              const status = r.matches?.status as string | undefined;
              const isConfirmed = status === "confirmed";
              const isPending   = status === "pending_attestation";
              const isDisputed  = status === "disputed";
              const isVoid      = status === "void";
              const won = r.rank === 1;
              const hasRating = r.elo_before != null && r.elo_after != null;
              const delta = hasRating ? Number(r.elo_after) - Number(r.elo_before) : null;

              // Armar matchup: nombres de team A y team B (primer nombre solo)
              const mps = (r.matches?.match_players ?? []) as Array<{
                team: number; user_id: string; score: number;
                profiles: { username: string; display_name: string | null } | null;
              }>;
              const firstNameOf = (mp: typeof mps[0]) =>
                (mp.profiles?.display_name?.split(" ")[0]) ?? mp.profiles?.username ?? "?";
              const teamAPlayers = mps.filter((mp) => mp.team === 1);
              const teamBPlayers = mps.filter((mp) => mp.team === 2);
              const nameA = teamAPlayers.map(firstNameOf).join(" & ");
              const nameB = teamBPlayers.map(firstNameOf).join(" & ");
              // Score: usa la suma denormalizada de match_players.score (puede estar 0 si no
              // se sincronizó). Para el viewer es informativo, no autoritativo.
              const scoreA = teamAPlayers.reduce((s, mp) => s + (mp.score ?? 0), 0);
              const scoreB = teamBPlayers.reduce((s, mp) => s + (mp.score ?? 0), 0);
              const hasScore = scoreA > 0 || scoreB > 0;
              const myTeamWon = r.team === 1 ? scoreA > scoreB : scoreB > scoreA;
              const winnerSide: "A" | "B" | null = !hasScore ? null : scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;

              return (
                <li key={`${r.match_id}-${r.team}`} className="py-3">
                  <Link href={`/matches/${r.match_id}`} className="block hover:bg-surface-2 -mx-2 px-2 py-1 rounded transition-colors">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`flex-1 truncate ${winnerSide === "A" ? "font-bold text-primary" : "text-text"}`}>{nameA || "?"}</span>
                      {hasScore ? (
                        <span className="font-mono tabular-nums shrink-0">
                          <span className={winnerSide === "A" ? "text-primary font-bold" : ""}>{scoreA}</span>
                          <span className="opacity-30 mx-1">—</span>
                          <span className={winnerSide === "B" ? "text-primary font-bold" : ""}>{scoreB}</span>
                        </span>
                      ) : (
                        <span className="text-text-mute text-xs shrink-0">vs</span>
                      )}
                      <span className={`flex-1 truncate text-right ${winnerSide === "B" ? "font-bold text-primary" : "text-text"}`}>{nameB || "?"}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-text-mute">
                      <span>{new Date(r.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
                      <span className="opacity-50">·</span>
                      <span>Parejas · {r.matches?.target_points} pts</span>
                      {isPending && <span className="badge bg-yellow-400/15 text-yellow-400 ml-auto">Pendiente</span>}
                      {isDisputed && <span className="badge bg-danger/15 text-danger ml-auto">Disputa</span>}
                      {isVoid && <span className="badge bg-surface-3 text-text-mute ml-auto">Anulada</span>}
                      {isConfirmed && hasRating && (
                        <>
                          <span className={`badge ml-auto ${myTeamWon ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                            {won ? "Ganó" : "Perdió"}
                          </span>
                          <span className={`font-mono ${delta! >= 0 ? "text-primary" : "text-danger"}`}>
                            {delta! >= 0 ? "+" : ""}{delta!}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-text-mute">Aún no ha jugado partidas.</p>
        )}
      </div>
    </div>
    </SecondaryPageShell>
  );
}

