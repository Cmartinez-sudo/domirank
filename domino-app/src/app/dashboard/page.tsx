import Link from "next/link";
import { requireUser, getCurrentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { NR_THRESHOLD, isRated } from "@/lib/rating";
import { PageTransition, StaggerChildren, StaggerItem } from "@/components/Motion";
import { TierBadge, RatingInfoTooltip } from "@/components/RatingInfo";
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";
import { NROnboardingCard } from "@/components/reliability/NROnboardingCard";
import { PendingAttestationsCard } from "@/components/dashboard/PendingAttestationsCard";
import { GameIcon } from "@/components/icons";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { ModalityCard } from "@/components/ModalityCard";
import { buildModalities } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const profile: any = await getCurrentProfile();
  if (!profile) return <p>No se pudo cargar tu perfil.</p>;

  // All display values come directly from profile_ratings view (single source of truth).
  // Never recompute from mu/sigma in TS — SQL is authoritative.
  const totalGames =
    (profile.d6_singles_games || 0) + (profile.d6_doubles_games || 0) +
    (profile.d9_singles_games || 0) + (profile.d9_doubles_games || 0);
  const rated = isRated(profile);
  const remainingToRated = Math.max(0, NR_THRESHOLD - totalGames);

  const globalDisplay  = Number(profile.global_display  ?? 1);

  const supabase = await supabaseServer();
  const { data: recent } = await supabase
    .from("match_players")
    .select("match_id, team, rank, elo_before, elo_after, created_at, matches(format, target_points, created_at, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Count confirmed matches for the push notification prompt condition.
  // Use `matches!inner(status)` so the .eq("matches.status", ...) filter
  // actually applies as a JOIN — otherwise supabase-js silently ignores it
  // and counts every match (incl. pending). See friends/page.tsx for the same pattern.
  const { count: confirmedCount } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(status)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("matches.status", "confirmed");

  return (
    <PageTransition>
      <StaggerChildren className="space-y-8">
        <StaggerItem>
          <NotificationPermissionPrompt confirmedMatchesCount={confirmedCount ?? 0} />
        </StaggerItem>
        <StaggerItem>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Hola, {profile.display_name || profile.username}</h1>
              <p className="text-text-dim">@{profile.username}</p>
            </div>
            <Link href="/matches/new" className="btn-primary">+ Nueva partida</Link>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,.08), rgba(59,130,246,.05))",
              borderColor: "rgba(16,185,129,.2)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="text-text-mute text-xs uppercase tracking-wider">DomiRank Global</div>
              <RatingInfoTooltip />
            </div>
            <div className="flex items-baseline gap-3 mt-1 flex-wrap">
              {rated ? (
                <>
                  <span
                    className="font-mono font-extrabold"
                    style={{
                      fontSize: "3.5rem",
                      lineHeight: 1,
                      backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {globalDisplay.toFixed(1)}
                  </span>
                  <div className="flex flex-col gap-1 items-start">
                    <TierBadge display={globalDisplay} />
                    <ReliabilityBadge
                      score={profile.reliability_score ?? 0}
                      showScore
                      factors={{
                        volume:      profile.reliability_volume,
                        recency:     profile.reliability_recency,
                        attestation: profile.reliability_attestation,
                        diversity:   profile.reliability_diversity,
                      }}
                      updatedAt={profile.reliability_updated_at}
                    />
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="font-mono font-extrabold text-text-mute"
                    style={{ fontSize: "3.5rem", lineHeight: 1 }}
                  >
                    NR
                  </span>
                  <span className="badge bg-amber-400/15 text-amber-400 text-[10px] uppercase tracking-wider font-semibold">
                    Calibrando
                  </span>
                </>
              )}
            </div>
            <div className="text-text-dim text-sm mt-2">
              {totalGames} {totalGames === 1 ? "partida" : "partidas"} totales
              {!rated && remainingToRated > 0 && (
                <> · faltan {remainingToRated} para activar tu rating</>
              )}
              {" · "}
              <Link href="/como-funciona" className="text-primary hover:underline">
                cómo se calcula
              </Link>
            </div>
          </div>
        </StaggerItem>

        {!rated && (
          <StaggerItem>
            <NROnboardingCard totalGames={totalGames} />
          </StaggerItem>
        )}

        <StaggerItem>
          <PendingAttestationsCard userId={user.id} />
        </StaggerItem>

        {totalGames === 0 ? (
          <StaggerItem>
            <FirstMatchCTA />
          </StaggerItem>
        ) : (
          <StaggerItem>
            <div className="grid md:grid-cols-2 gap-4">
              {buildModalities(profile).map((m) => (
                <ModalityCard key={m.key} modality={m} isOwnView variant="detailed" />
              ))}
            </div>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Tus últimas partidas</h2>
            {recent && recent.length > 0 ? (
              <ul className="divide-y divide-border">
                {recent.map((r: any) => {
                  const status = r.matches?.status as string | undefined;
                  const isConfirmed = status === "confirmed";
                  const isPending   = status === "pending_attestation";
                  const isDisputed  = status === "disputed";
                  const isVoid      = status === "void";
                  const won = r.rank === 1;
                  const hasRating = r.elo_before != null && r.elo_after != null;
                  const delta = hasRating ? Number(r.elo_after) - Number(r.elo_before) : null;
                  return (
                    <li key={`${r.match_id}-${r.team}`} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/matches/${r.match_id}`} className="font-medium hover:text-primary truncate block">
                          {r.matches?.format === "singles" ? "Singles" : "Parejas"} · {r.matches?.target_points} pts
                        </Link>
                        <div className="text-text-mute text-xs">
                          {new Date(r.created_at).toLocaleString("es")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-shrink-0">
                        {isPending && (
                          <span className="badge bg-yellow-400/15 text-yellow-400">Pendiente</span>
                        )}
                        {isDisputed && (
                          <span className="badge bg-danger/15 text-danger">Disputa</span>
                        )}
                        {isVoid && (
                          <span className="badge bg-surface-3 text-text-mute">Anulada</span>
                        )}
                        {isConfirmed && hasRating && (
                          <>
                            <span className={`badge ${won ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                              {won ? "Ganó" : "Perdió"}
                            </span>
                            <span className={`font-mono ${delta! >= 0 ? "text-primary" : "text-danger"}`}>
                              {delta! >= 0 ? "+" : ""}{delta!} Elo
                            </span>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-10">
                <div className="mb-3 flex justify-center text-text-mute select-none">
                  <GameIcon size={56} />
                </div>
                <p className="text-text-dim font-medium mb-1">Aún no has jugado ninguna partida.</p>
                <p className="text-text-mute text-sm mb-5">Registra tu primera partida y empieza a construir tu DomiRank.</p>
                <Link href="/matches/new" className="btn-primary">+ Nueva partida</Link>
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerChildren>
    </PageTransition>
  );
}

/**
 * Zero-state card mostrada cuando el usuario no tiene NINGUNA partida.
 * Evita el "efecto cementerio" de 4 cards vacías con el mismo CTA.
 */
function FirstMatchCTA() {
  return (
    <div
      className="card text-center"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,.10), rgba(59,130,246,.06))",
        borderColor: "rgba(16,185,129,.25)",
      }}
    >
      <div className="mb-3 flex justify-center" aria-hidden="true">
        <GameIcon className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Juega tu primera partida</h2>
      <p className="text-text-dim text-sm mt-2 max-w-md mx-auto">
        Aún no tienes partidas registradas. Crea una para empezar a calibrar
        tu rating DomiRank.
      </p>
      <Link
        href="/matches/new"
        className="btn-primary mt-4 inline-block"
      >
        + Nueva partida
      </Link>
    </div>
  );
}
