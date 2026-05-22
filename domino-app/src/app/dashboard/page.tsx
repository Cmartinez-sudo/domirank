import Link from "next/link";
import { requireUser, getCurrentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";
import { PageTransition, StaggerChildren, StaggerItem } from "@/components/Motion";
import { TierBadge, RatingInfoTooltip } from "@/components/RatingInfo";
import { PendingAttestationsCard } from "@/components/dashboard/PendingAttestationsCard";
import { GameIcon } from "@/components/icons";

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
  const qualified = totalGames >= DOMIRANK_MIN_GAMES;

  const globalDisplay  = Number(profile.global_display  ?? 1);
  const singlesDisplay = Number(profile.d6_singles_display ?? 1);
  const doublesDisplay = Number(profile.d6_doubles_display ?? 1);
  const singlesElo     = Number(profile.d6_singles_elo ?? 1500);
  const doublesElo     = Number(profile.d6_doubles_elo ?? 1500);

  const supabase = await supabaseServer();
  const { data: recent } = await supabase
    .from("match_players")
    .select("match_id, team, rank, elo_before, elo_after, created_at, matches(format, target_points, created_at, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <PageTransition>
      <StaggerChildren className="space-y-8">
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
              <span
                className="font-mono font-extrabold"
                style={{
                  fontSize: "3.5rem",
                  lineHeight: 1,
                  backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  opacity: qualified ? 1 : 0.85,
                }}
              >
                {globalDisplay.toFixed(1)}
              </span>
              <div className="flex flex-col gap-1">
                <TierBadge display={globalDisplay} />
                {!qualified && (
                  <span className="text-text-mute text-[10px] uppercase tracking-wider font-semibold">
                    Provisional
                  </span>
                )}
              </div>
            </div>
            <div className="text-text-dim text-sm mt-2">
              {totalGames} {totalGames === 1 ? "partida" : "partidas"} totales
              {!qualified && (
                <> · faltan {DOMIRANK_MIN_GAMES - totalGames} para confirmar tu rating</>
              )}
              {" · "}
              <Link href="/como-funciona" className="text-primary hover:underline">
                cómo se calcula
              </Link>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <PendingAttestationsCard userId={user.id} />
        </StaggerItem>

        <StaggerItem>
          <div className="grid md:grid-cols-2 gap-4">
            <RatingCard
              title="Singles (1v1)"
              display={singlesDisplay}
              elo={singlesElo}
              games={profile.d6_singles_games || 0}
              wins={profile.d6_singles_wins || 0}
              losses={profile.d6_singles_losses || 0}
            />
            <RatingCard
              title="Parejas (2v2)"
              display={doublesDisplay}
              elo={doublesElo}
              games={profile.d6_doubles_games || 0}
              wins={profile.d6_doubles_wins || 0}
              losses={profile.d6_doubles_losses || 0}
            />
          </div>
        </StaggerItem>

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

function RatingCard({ title, display, elo, games, wins, losses }: {
  title: string; display: number; elo: number;
  games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  const isProvisional = games > 0 && games < 10;
  return (
    <div className="card">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className="text-4xl font-bold text-primary font-mono">{games > 0 ? display.toFixed(1) : "—"}</span>
        {games > 0 && <TierBadge display={display} />}
        {isProvisional && (
          <span className="text-text-mute text-[10px] uppercase tracking-wider font-semibold">Provisional</span>
        )}
      </div>
      {games > 0 && <div className="text-text-mute text-xs mt-0.5">Elo {elo}</div>}
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <div>
          <div className="text-text-mute text-xs">Partidas</div>
          <div className="font-mono">{games}</div>
        </div>
        <div>
          <div className="text-text-mute text-xs">G / P</div>
          <div className="font-mono">
            <span className="text-primary">{wins}</span>
            <span className="text-text-mute"> / </span>
            <span className="text-danger">{losses}</span>
          </div>
        </div>
        <div>
          <div className="text-text-mute text-xs">W%</div>
          <div className="font-mono">{winRate !== null ? `${winRate}%` : "—"}</div>
        </div>
      </div>
    </div>
  );
}
