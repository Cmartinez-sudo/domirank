import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  computePartnerRivalStats,
  computeStreaks,
  aggregateEloSeries,
  buildHeatmap,
  buildFormStrip,
  type HistoryRow,
  type EloRow,
  type StreakResult,
} from "@/lib/profile-stats";
import { StatTiles } from "@/components/profile/StatTiles";
import { EloCurveSection } from "@/components/profile/EloCurveSection";
import { StreaksSection } from "@/components/profile/StreaksSection";
import { HistoryList } from "@/components/profile/HistoryList";
import { RingStat } from "@/components/charts/RingStat";
import { BarStat } from "@/components/charts/BarStat";

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
  const globalDisplay = Number.isFinite(Number(p.global_display)) ? Number(p.global_display) : 1;

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

  const canSeeDetail = isOwnProfile || relation.kind === "friends";

  let history: any[] = [];
  let favoritePartner: { name: string; games: number; wins: number; losses: number } | null = null;
  let toughestRival:   { name: string; games: number; my_wins: number; my_losses: number } | null = null;
  let allRows: HistoryRow[] = [];
  let eloAll: ReturnType<typeof aggregateEloSeries> = [];
  let eloLast50: ReturnType<typeof aggregateEloSeries> = [];
  let eloLast10: ReturnType<typeof aggregateEloSeries> = [];
  let streaks: StreakResult = { current: { kind: "none", count: 0 }, best: 0 };
  let heatmap: ReturnType<typeof buildHeatmap> = [];
  let form: ReturnType<typeof buildFormStrip> = [];

  try {
    const [historyRes, eloRes] = await Promise.all([
      supabase
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
        .limit(50),
      supabase
        .from("match_players")
        .select(`elo_after, created_at, matches!inner(status)`)
        .eq("user_id", p.id)
        .eq("matches.status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    allRows = ((historyRes.data ?? []) as any[]).filter((r) => {
      const st = r.matches?.status;
      if (isOwnProfile) return ["confirmed", "pending_attestation", "disputed", "void"].includes(st);
      return st === "confirmed";
    }) as HistoryRow[];

    history = allRows.slice(0, 50);

    const { favoritePartner: fp, toughestRival: tr } = computePartnerRivalStats(allRows, p.id);
    favoritePartner = fp ? { name: fp.name, games: fp.games, wins: fp.wins, losses: fp.losses } : null;
    toughestRival   = tr ? { name: tr.name, games: tr.games, my_wins: tr.my_wins, my_losses: tr.my_losses } : null;

    streaks = computeStreaks(allRows);
    heatmap = buildHeatmap(allRows);
    form    = buildFormStrip(allRows, 10);

    const eloRaw = ((eloRes.data ?? []) as any[]) as EloRow[];
    eloAll    = aggregateEloSeries(eloRaw, "all");
    eloLast50 = aggregateEloSeries(eloRaw, "last50");
    eloLast10 = aggregateEloSeries(eloRaw, "last10");
  } catch (e) {
    console.error("[profile] history failed:", e);
  }

  const isNovato0 = isOwnProfile && (p.total_games ?? 0) === 0;

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

        {isNovato0 ? (
          <div className="card text-center py-8">
            <h3 className="text-lg font-semibold mb-2">Juega tu primera partida</h3>
            <p className="text-text-mute text-sm mb-4">Registra una partida y empieza a ver tu DomiRank crecer.</p>
            <Link href="/wizard" className="btn btn-primary inline-block">Nueva partida</Link>
          </div>
        ) : (
          <>
            {(p.total_games ?? 0) >= 1 && (
              <StatTiles
                games={p.total_games ?? 0}
                winRate={Number(p.win_rate ?? 0) * 100}
                effectiveness={Number(p.effectiveness ?? 0) * 100}
                bestStreak={streaks.best}
              />
            )}

            {canSeeDetail && (p.total_games ?? 0) >= 5 && eloAll.length >= 2 && (
              <EloCurveSection points={eloAll} points50={eloLast50} points10={eloLast10} />
            )}

            {(p.total_games ?? 0) >= 1 && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Rendimiento global</h2>
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <RingStat
                    value={Number(p.win_rate ?? 0) * 100}
                    label="Win rate"
                    sublabel={`${p.wins ?? 0}V - ${p.losses ?? 0}D`}
                    ariaLabel={`Win rate ${(Number(p.win_rate ?? 0) * 100).toFixed(0)} por ciento`}
                  />
                  <div className="flex-1">
                    <BarStat
                      value={Number(p.effectiveness ?? 0) * 100}
                      label="Efectividad"
                      sublabel={`${Number(p.points_for ?? 0)} puntos a favor / ${Number(p.points_against ?? 0)} en contra`}
                      ariaLabel="Efectividad"
                    />
                  </div>
                </div>
              </div>
            )}

            {canSeeDetail && (p.total_games ?? 0) >= 5 && (
              <StreaksSection streaks={streaks} form={form} heatmap={heatmap} />
            )}

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

            {!canSeeDetail && !isOwnProfile && (p.total_games ?? 0) >= 1 && (
              <div className="card text-center py-8">
                <h3 className="text-lg font-semibold mb-2">Agrega a {p.display_name || p.username}</h3>
                <p className="text-text-mute text-sm mb-4">Para ver su curva de DomiRank, actividad reciente e historial completo.</p>
                <div className="inline-block">
                  <FriendActionButton targetUserId={p.id} targetUsername={p.username} initialStatus={relation} />
                </div>
              </div>
            )}

            {canSeeDetail && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-3">Historial reciente</h2>
                <HistoryList rows={history} />
              </div>
            )}
          </>
        )}
      </div>
    </SecondaryPageShell>
  );
}
