import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";
import { PageTransition } from "@/components/Motion";
import { TierBadge } from "@/components/RatingInfo";

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
      .gte("total_games", DOMIRANK_MIN_GAMES)
      .order("global_ordinal", { ascending: false })
      .limit(100);
    rows = data ?? [];
  } else {
    const orderCol = tab === "singles" ? "d6_singles_ordinal" : "d6_doubles_ordinal";
    const gamesCol = tab === "singles" ? "d6_singles_games"   : "d6_doubles_games";
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
              <th className="px-4 py-3 text-right">DomiRank</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">μ</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">σ</th>
              <th className="px-4 py-3 text-right">Partidas</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                {tab === "global" ? "S / P" : "W%"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-text-mute">
                {tab === "global"
                  ? `Aún nadie tiene ${DOMIRANK_MIN_GAMES}+ partidas para entrar al ranking global.`
                  : `Sin jugadores con partidas en ${tab === "singles" ? "singles" : "parejas"} todavía.`}
              </td></tr>
            ) : rows.map((r, i) => {
              const isGlobal = tab === "global";
              const display = isGlobal ? r.global_display
                : tab === "singles" ? r.d6_singles_display : r.d6_doubles_display;
              const ordinal = isGlobal ? r.global_ordinal
                : tab === "singles" ? r.d6_singles_ordinal : r.d6_doubles_ordinal;
              const mu      = isGlobal ? r.global_mu
                : tab === "singles" ? r.d6_singles_mu : r.d6_doubles_mu;
              const sigma   = isGlobal ? r.global_sigma
                : tab === "singles" ? r.d6_singles_sigma : r.d6_doubles_sigma;
              const games   = isGlobal ? r.total_games
                : tab === "singles" ? r.d6_singles_games : r.d6_doubles_games;
              const wins    = tab === "singles" ? r.d6_singles_wins
                : tab === "doubles" ? r.d6_doubles_wins : 0;
              const losses  = tab === "singles" ? r.d6_singles_losses
                : tab === "doubles" ? r.d6_doubles_losses : 0;
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
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim text-sm">
                    {Number(mu).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim text-sm">
                    {Number(sigma).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">{games}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-sm">
                    {isGlobal
                      ? <span className="text-text-dim">{r.d6_singles_games ?? r.singles_games ?? 0} <span className="text-text-mute">·</span> {r.d6_doubles_games ?? r.doubles_games ?? 0}</span>
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
          ? `DomiRank Global combina tus ratings de singles y parejas ponderando por certeza (1/σ²). Cuanto más juegas un formato, más pesa. Mínimo ${DOMIRANK_MIN_GAMES} partidas totales.`
          : "Rating = μ − 3σ (OpenSkill ordinal). W% = partidas ganadas. μ es el skill estimado, σ la incertidumbre."}
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
