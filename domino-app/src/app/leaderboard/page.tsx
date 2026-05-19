import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";

export const dynamic = "force-dynamic";

type Row = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  singles_mu: number; singles_sigma: number; singles_games: number; singles_wins: number; singles_losses: number;
  singles_ordinal: number;
  doubles_mu: number; doubles_sigma: number; doubles_games: number; doubles_wins: number; doubles_losses: number;
  doubles_ordinal: number;
  global_mu: number; global_sigma: number; global_ordinal: number;
  total_games: number;
};

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

  let rows: Row[] = [];
  if (tab === "global") {
    const { data } = await supabase
      .from("profile_ratings")
      .select("*")
      .gte("total_games", DOMIRANK_MIN_GAMES)
      .order("global_ordinal", { ascending: false })
      .limit(100);
    rows = (data as Row[]) ?? [];
  } else {
    const orderCol = tab === "singles" ? "singles_ordinal" : "doubles_ordinal";
    const gamesCol = tab === "singles" ? "singles_games"   : "doubles_games";
    const { data } = await supabase
      .from("profile_ratings")
      .select("*")
      .gt(gamesCol, 0)
      .order(orderCol, { ascending: false })
      .limit(100);
    rows = (data as Row[]) ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Ranking</h1>
        <div className="flex gap-1 bg-surface rounded-md p-1 border border-border">
          <TabLink href="/leaderboard?tab=global"  active={tab==="global"}>DomiRank Global</TabLink>
          <TabLink href="/leaderboard?tab=singles" active={tab==="singles"}>Singles</TabLink>
          <TabLink href="/leaderboard?tab=doubles" active={tab==="doubles"}>Parejas</TabLink>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="text-left text-text-mute text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3 text-right">Rating</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">μ</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">σ</th>
              <th className="px-4 py-3 text-right">Partidas</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">
                {tab === "global" ? "S / P" : "G-P"}
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
              const ordinal = isGlobal ? r.global_ordinal : tab === "singles" ? r.singles_ordinal : r.doubles_ordinal;
              const mu      = isGlobal ? r.global_mu      : tab === "singles" ? r.singles_mu      : r.doubles_mu;
              const sigma   = isGlobal ? r.global_sigma   : tab === "singles" ? r.singles_sigma   : r.doubles_sigma;
              const games   = isGlobal ? r.total_games    : tab === "singles" ? r.singles_games   : r.doubles_games;
              const wins    = tab === "singles" ? r.singles_wins : tab === "doubles" ? r.doubles_wins : 0;
              const losses  = tab === "singles" ? r.singles_losses : tab === "doubles" ? r.doubles_losses : 0;
              return (
                <tr key={r.username} className="border-b border-border/50 hover:bg-surface-2/60">
                  <td className="px-4 py-3 text-text-mute">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/profile/${r.username}`} className="flex items-center gap-2 hover:text-primary">
                      <Avatar player={{ username: r.username, display_name: r.display_name, avatar_url: r.avatar_url }} size={32} />
                      <div>
                        <div className="font-medium">{r.display_name || r.username}</div>
                        <div className="text-text-mute text-xs">@{r.username}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                    {Number(ordinal).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim text-sm">
                    {Number(mu).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim text-sm">
                    {Number(sigma).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">{games}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-text-dim text-sm">
                    {isGlobal
                      ? <span>{r.singles_games} <span className="text-text-mute">·</span> {r.doubles_games}</span>
                      : <span><span className="text-primary">{wins}</span>-<span className="text-danger">{losses}</span></span>}
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
          : "Rating = μ − 3σ (OpenSkill ordinal). μ es el skill estimado, σ la incertidumbre."}
      </p>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded text-sm ${active ? "bg-surface-3 text-text" : "text-text-dim hover:text-text"}`}
    >
      {children}
    </Link>
  );
}
