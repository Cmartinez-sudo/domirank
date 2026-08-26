import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";
import { PageTransition } from "@/components/Motion";
import { TierBadge, ColHeader } from "@/components/RatingInfo";
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ranking global",
  description: "Top 100 jugadores de dominó de DomiRank, ordenados por rating global. Rating por modalidad, confiabilidad y país.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Ranking global · DomiRank",
    description: "Los mejores jugadores de dominó del ranking DomiRank.",
    url: "/leaderboard",
    type: "website",
  },
};

export default async function Leaderboard() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("profile_ratings")
    .select("*")
    .eq("is_rated", true)
    .order("global_elo", { ascending: false })
    .limit(100);
  const rows = data ?? [];

  return (
    <PageTransition>
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ranking</h1>

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
                  tooltip="Tu rating visible (1-20). Promedio ponderado por partidas de tus buckets jugados (d6 + d9 parejas)."
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
                  tooltip={`Total de partidas confirmadas (d6 + d9 parejas). Mínimo ${DOMIRANK_MIN_GAMES} para aparecer en el ranking.`}
                />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader label="G" align="right" tooltip="Partidas ganadas." />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader label="P" align="right" tooltip="Partidas perdidas." />
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">
                <ColHeader label="Pts+" align="right" tooltip="Puntos anotados por tu equipo." />
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">
                <ColHeader label="Pts−" align="right" tooltip="Puntos anotados por el equipo contrario." />
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                <ColHeader
                  label="d6 / d9"
                  align="right"
                  tooltip="Partidas en doble-6 · partidas en doble-9 (ambas en parejas)."
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-text-mute">
                {`Aún nadie tiene ${DOMIRANK_MIN_GAMES}+ partidas para entrar al ranking.`}
              </td></tr>
            ) : rows.map((r, i) => {
              const display = r.global_display;
              const elo     = r.global_elo;
              const games   = r.total_games;
              const wins    = r.total_wins   ?? 0;
              const losses  = r.total_losses ?? 0;
              const ptsWon  = r.total_points_won  ?? 0;
              const ptsLost = r.total_points_lost ?? 0;

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
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono font-bold text-primary tabular-nums">{Number(display ?? 1).toFixed(1)}</span>
                      {display != null && <TierBadge display={Number(display)} size="xs" />}
                      {r.reliability_score != null && (
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
                    <span className="text-text-dim">
                      {r.d6_doubles_games ?? 0} <span className="text-text-mute">·</span> {r.d9_doubles_games ?? 0}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-text-mute text-xs text-center">
        DomiRank Global = promedio ponderado por partidas de tus buckets activos (d6 + d9 parejas). Mínimo {DOMIRANK_MIN_GAMES} partidas para aparecer aquí.
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
