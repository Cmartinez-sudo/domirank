import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES, toDisplayRating } from "@/lib/rating";
import { TierBadge, RatingInfoTooltip } from "@/components/RatingInfo";
import { FriendActionButton } from "@/components/FriendActionButton";
import { getRelationStatus } from "@/lib/friends";

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
  const qualified = p.total_games >= DOMIRANK_MIN_GAMES;
  const globalDisplay = Number(p.global_display ?? toDisplayRating(Number(p.global_ordinal)));
  const relation = await getRelationStatus(p.id);

  // Privacidad: si el viewer NO es el dueño del perfil, solo mostramos
  // partidas confirmed. El propio dueño ve también pending/disputed/void.
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isOwnProfile = viewer?.id === p.id;

  const { data: historyRaw } = await supabase
    .from("match_players")
    .select("match_id, team, rank, mu_before, mu_after, created_at, matches(format, target_points, status)")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const history = ((historyRaw ?? []) as any[])
    .filter((r) => {
      const st = r.matches?.status;
      if (isOwnProfile) return ["confirmed","pending_attestation","disputed","void"].includes(st);
      return st === "confirmed";
    })
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Avatar player={p} size={72} />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold truncate">{p.display_name || p.username}</h1>
              <p className="text-text-mute">@{p.username}</p>
              {p.bio && (
                <p className="text-text-dim text-sm mt-1 max-w-xs">{p.bio}</p>
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
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="text-text-mute text-xs uppercase tracking-wider">DomiRank Global</div>
              <RatingInfoTooltip />
            </div>
            <div
              className="font-mono font-extrabold"
              style={{
                fontSize: "2.75rem",
                lineHeight: 1,
                backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                opacity: qualified ? 1 : 0.85,
              }}
            >
              {globalDisplay.toFixed(1)}
            </div>
            <div className="flex justify-end gap-2 items-center mt-1">
              <TierBadge display={globalDisplay} />
              {!qualified && (
                <span className="text-text-mute text-[10px] uppercase tracking-wider font-semibold">
                  Provisional
                </span>
              )}
            </div>
            <div className="text-text-mute text-xs mt-1">
              {p.total_games} {p.total_games === 1 ? "partida" : "partidas"} totales
              {!qualified && ` · faltan ${DOMIRANK_MIN_GAMES - p.total_games} para confirmar`}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <StatBlock
            title="Singles (6-6)"
            display={Number(p.d6_singles_display ?? toDisplayRating(Number(p.d6_singles_ordinal)))}
            ordinal={Number(p.d6_singles_ordinal)}
            games={p.d6_singles_games}
            wins={p.d6_singles_wins}
            losses={p.d6_singles_losses}
          />
          <StatBlock
            title="Parejas (6-6)"
            display={Number(p.d6_doubles_display ?? toDisplayRating(Number(p.d6_doubles_ordinal)))}
            ordinal={Number(p.d6_doubles_ordinal)}
            games={p.d6_doubles_games}
            wins={p.d6_doubles_wins}
            losses={p.d6_doubles_losses}
          />
        </div>

        {(p.d9_singles_games > 0 || p.d9_doubles_games > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <StatBlock
              title="Singles (9-9)"
              display={Number(p.d9_singles_display ?? toDisplayRating(Number(p.d9_singles_ordinal)))}
              ordinal={Number(p.d9_singles_ordinal)}
              games={p.d9_singles_games}
              wins={p.d9_singles_wins}
              losses={p.d9_singles_losses}
            />
            <StatBlock
              title="Parejas (9-9)"
              display={Number(p.d9_doubles_display ?? toDisplayRating(Number(p.d9_doubles_ordinal)))}
              ordinal={Number(p.d9_doubles_ordinal)}
              games={p.d9_doubles_games}
              wins={p.d9_doubles_wins}
              losses={p.d9_doubles_losses}
            />
          </div>
        )}
      </div>

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
              const hasRating = r.mu_before != null && r.mu_after != null;
              const delta = hasRating ? Number(r.mu_after) - Number(r.mu_before) : null;
              return (
                <li key={`${r.match_id}-${r.team}`} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/matches/${r.match_id}`} className="hover:text-primary font-medium truncate block">
                      {r.matches?.format === "singles" ? "Singles" : "Parejas"} · {r.matches?.target_points} pts
                    </Link>
                    <div className="text-text-mute text-xs">
                      {new Date(r.created_at).toLocaleDateString("es")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-shrink-0">
                    {isPending && <span className="badge bg-yellow-400/15 text-yellow-400">Pendiente</span>}
                    {isDisputed && <span className="badge bg-danger/15 text-danger">Disputa</span>}
                    {isVoid && <span className="badge bg-surface-3 text-text-mute">Anulada</span>}
                    {isConfirmed && hasRating && <>
                    <span className={`badge ${won ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                      {won ? "Ganó" : "Perdió"}
                    </span>
                    <span className={`font-mono ${delta! >= 0 ? "text-primary" : "text-danger"}`}>
                      {delta! >= 0 ? "+" : ""}{delta!.toFixed(2)}
                    </span>
                    </>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-text-mute">Aún no ha jugado partidas.</p>
        )}
      </div>
    </div>
  );
}

function StatBlock({ title, display, ordinal, games, wins, losses }: {
  title: string; display: number; ordinal: number; games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  return (
    <div className="bg-surface-2 rounded-md p-4">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className="text-3xl font-bold text-primary font-mono">
          {games > 0 ? display.toFixed(1) : "—"}
        </span>
        {games > 0 && <TierBadge display={display} />}
      </div>
      {games > 0 && <div className="text-text-mute text-xs mt-0.5">ordinal {ordinal.toFixed(2)}</div>}
      <div className="flex items-center gap-3 mt-2 text-sm">
        <span className="text-text-dim">{games} partidas</span>
        <span className="text-primary">{wins}G</span>
        <span className="text-danger">{losses}P</span>
        {winRate !== null && (
          <span className="text-text-mute">{winRate}%</span>
        )}
      </div>
    </div>
  );
}
