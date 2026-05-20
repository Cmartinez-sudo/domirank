import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { COUNTRIES } from "@/lib/modalidades";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";

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
  const countryInfo = COUNTRIES.find((c) => c.code === p.country);

  const { data: history } = await supabase
    .from("match_players")
    .select("match_id, team, rank, mu_before, mu_after, created_at, matches(format, target_points)")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Avatar player={p} size={72} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold">{p.display_name || p.username}</h1>
                {countryInfo && (
                  <span className="text-2xl" title={countryInfo.name}>{countryInfo.flag}</span>
                )}
              </div>
              <p className="text-text-mute">@{p.username}</p>
              {p.bio && (
                <p className="text-text-dim text-sm mt-1 max-w-xs">{p.bio}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-text-mute text-xs uppercase tracking-wider">DomiRank Global</div>
            <div
              className="font-mono font-extrabold"
              style={{
                fontSize: "2.75rem",
                lineHeight: 1,
                backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {qualified ? Number(p.global_ordinal).toFixed(1) : "—"}
            </div>
            <div className="text-text-mute text-xs mt-1">
              {p.total_games} partidas totales
              {!qualified && ` · faltan ${DOMIRANK_MIN_GAMES - p.total_games}`}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <StatBlock
            title="Singles (6-6)"
            ordinal={Number(p.d6_singles_ordinal)}
            games={p.d6_singles_games}
            wins={p.d6_singles_wins}
            losses={p.d6_singles_losses}
          />
          <StatBlock
            title="Parejas (6-6)"
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
              ordinal={Number(p.d9_singles_ordinal)}
              games={p.d9_singles_games}
              wins={p.d9_singles_wins}
              losses={p.d9_singles_losses}
            />
            <StatBlock
              title="Parejas (9-9)"
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
              const won = r.rank === 1;
              const delta = Number(r.mu_after) - Number(r.mu_before);
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
                  <div className="flex items-center gap-3 text-sm flex-shrink-0">
                    <span className={`badge ${won ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                      {won ? "Ganó" : "Perdió"}
                    </span>
                    <span className={`font-mono ${delta >= 0 ? "text-primary" : "text-danger"}`}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                    </span>
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

function StatBlock({ title, ordinal, games, wins, losses }: {
  title: string; ordinal: number; games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  return (
    <div className="bg-surface-2 rounded-md p-4">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="text-3xl font-bold text-primary font-mono mt-1">
        {games > 0 ? ordinal.toFixed(1) : "—"}
      </div>
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
