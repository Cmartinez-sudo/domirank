import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";
import { PageTransition } from "@/components/Motion";
import { TierBadge, ColHeader } from "@/components/RatingInfo";
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";

export const dynamic = "force-dynamic";

export default async function Leaderboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: "global" | "singles" | "doubles" =
    params.tab === "singles" ? "singles" :
    params.tab === "doubles" ? "doubles" : "global";

  const supabase = await supabaseServer();

  let rows: any[] = [];
  if (tab === "global") {
    const { data } = await supabase
      .from("profile_ratings")
      .select("*")
      .eq("is_rated", true)
      .order("global_elo", { ascending: false })
      .limit(100);
    rows = data ?? [];
  } else {
    const orderCol = tab === "singles" ? "d6_singles_elo" : "d6_doubles_elo";
    const gamesCol = tab === "singles" ? "d6_singles_games" : "d6_doubles_games";
    const { data } = await supabase
      .from("profile_ratings")
      .select("*")
      .gt(gamesCol, 0)
      .order(orderCol, { ascending: false })
      .limit(100);
    rows = data ?? [];
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Ranking</h1>
        <div className="flex gap-1 bg-surface rounded-md p-1 border border-border">
          <TabLink href="/leaderboard?tab=global"  active={tab === "global"}>DomiRank Global</TabLink>
          <TabLink href="/leaderboard?tab=singles" active={tab === "singles"}>Singles</TabLink>
          <TabLink href="/leaderboard?tab=doubles" active={tab === "doubles"}>Parejas</TabLink>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="text-left text-text-mute text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3 text-right">
                <ColHeader
                  label="DomiRank"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Tu rating visible (1-20). Promedio ponderado por partidas de tus buckets jugados. Si solo juegas un formato, esto = tu rating en ese formato."
                      : "Tu rating visible (1-20) en este formato. Anchors: Elo 1000 → 1.0, Elo 2200 → 20.0."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell">
                <ColHeader
                  label="Elo"
                  align="right"
                  tooltip="Rating Elo interno. Empieza en 1500 y se mueve con cada partida confirmada. Sube al ganar, baja al perder. Primeras 10 partidas son 'Provisional' (K=40, se mueve más rápido)."
                />
              </th>
              <th className="px-4 py-3 text-right">
                <ColHeader
                  label="Partidas"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? `Total de partidas confirmadas en todos los formatos. Mínimo ${DOMIRANK_MIN_GAMES} para aparecer en el global.`
                      : "Partidas confirmadas en este formato."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader
                  label="G"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Partidas ganadas en todos los formatos."
                      : "Partidas ganadas en este formato."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader
                  label="P"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Partidas perdidas en todos los formatos."
                      : "Partidas perdidas en este formato."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">
                <ColHeader
                  label="Pts+"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Puntos anotados por tu equipo en todas tus partidas."
                      : "Puntos anotados por tu equipo en este formato."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">
                <ColHeader
                  label="Pts−"
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Puntos anotados por el equipo contrario en todas tus partidas."
                      : "Puntos anotados por el equipo contrario en este formato."
                  }
                />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader
                  label={tab === "global" ? "S / P" : "W%"}
                  align="right"
                  tooltip={
                    tab === "global"
                      ? "Partidas en singles · partidas en parejas (doble-6)."
                      : "Porcentaje de partidas ganadas en este formato."
                  }
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-text-mute">
                {tab === "global"
                  ? `Aún nadie tiene ${DOMIRANK_MIN_GAMES}+ partidas para entrar al ranking global.`
                  : `Sin jugadores con partidas en ${tab === "singles" ? "singles" : "parejas"} todavía.`}
              </td></tr>
            ) : rows.map((r, i) => {
              const isGlobal = tab === "global";
              const display = isGlobal ? r.global_display
                : tab === "singles" ? r.d6_singles_display : r.d6_doubles_display;
              const elo     = isGlobal ? r.global_elo
                : tab === "singles" ? r.d6_singles_elo : r.d6_doubles_elo;
              const games   = isGlobal ? r.total_games
                : tab === "singles" ? r.d6_singles_games : r.d6_doubles_games;
              const wins    = isGlobal ? (r.total_wins   ?? 0)
                : tab === "singles" ? (r.d6_singles_wins   ?? 0) : (r.d6_doubles_wins   ?? 0);
              const losses  = isGlobal ? (r.total_losses ?? 0)
                : tab === "singles" ? (r.d6_singles_losses ?? 0) : (r.d6_doubles_losses ?? 0);
              const ptsWon  = isGlobal ? (r.total_points_won  ?? 0)
                : tab === "singles" ? (r.d6_singles_points_won  ?? 0) : (r.d6_doubles_points_won  ?? 0);
              const ptsLost = isGlobal ? (r.total_points_lost ?? 0)
                : tab === "singles" ? (r.d6_singles_points_lost ?? 0) : (r.d6_doubles_points_lost ?? 0);
              const winRate = games > 0 ? Math.round((wins / games) * 100) : null;

              return (
                <tr
                  key={r.id ?? r.username}
                  className={`border-b border-border/50 hover:bg-surface-2/60 transition-colors ${
                    i === 0 ? "bg-yellow-400/[.025]" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <RankCell rank={i + 1} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/profile/${r.username}`} className="flex items-center gap-2 hover:text-primary">
                      <Avatar player={{ username: r.username, display_name: r.display_name, avatar_url: r.avatar_url }} size={32} />
                      <div>
                        <div className="font-medium">{r.display_name || r.username}</div>
                        <div className="text-text-mute text-xs">@{r.username}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono font-bold text-primary">{Number(display ?? 1).toFixed(1)}</span>
                      {display != null && <TierBadge display={Number(display)} />}
                      {isGlobal && r.reliability_score != null && (
                        <ReliabilityBadge
                          score={r.reliability_score}
                          size="xs"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim text-sm">
                    {Number(elo)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{games}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-primary">{wins}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-danger">{losses}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-text-dim text-sm">{ptsWon}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-text-dim text-sm">{ptsLost}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-sm">
                    {isGlobal
                      ? <span className="text-text-dim">{r.d6_singles_games ?? 0} <span className="text-text-mute">·</span> {r.d6_doubles_games ?? 0}</span>
                      : <span className={winRate !== null && winRate >= 50 ? "text-primary" : "text-text-dim"}>
                          {winRate !== null ? `${winRate}%` : "—"}
                        </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-text-mute text-xs text-center">
        {tab === "global"
          ? `DomiRank Global = promedio ponderado por partidas de tus buckets activos. Mínimo ${DOMIRANK_MIN_GAMES} partidas totales para aparecer aquí.`
          : "DomiRank = to_display(Elo): 1 + ((elo - 1000) / 1200) × 19. W% = partidas ganadas. Provisional = primeras 10 partidas en este formato."}
      </p>
    </div>
    </PageTransition>
  );
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400/15 text-yellow-400 font-bold text-sm">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/15 text-slate-300 font-bold text-sm">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/15 text-amber-500 font-bold text-sm">
        3
      </span>
    );
  }
  return <span className="text-text-mute text-sm pl-1">{rank}</span>;
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-text-dim hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
