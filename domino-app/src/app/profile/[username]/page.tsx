import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
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
  const qualified = profile.total_games >= DOMIRANK_MIN_GAMES;

  const { data: history } = await supabase
    .from("match_players")
    .select("match_id, team, rank, mu_before, mu_after, created_at, matches(format, target_points)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Avatar player={profile as any} size={72} />
            <div>
              <h1 className="text-3xl font-bold">{profile.display_name || profile.username}</h1>
              <p className="text-text-mute">@{profile.username}</p>
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
              {qualified ? Number(profile.global_ordinal).toFixed(1) : "—"}
            </div>
            <div className="text-text-mute text-xs mt-1">
              {profile.total_games} partidas totales
              {!qualified && ` · faltan ${DOMIRANK_MIN_GAMES - profile.total_games}`}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Block title="Singles"
            ordinal={Number(profile.singles_ordinal)}
            games={profile.singles_games}
            wins={profile.singles_wins}
            losses={profile.singles_losses} />
          <Block title="Parejas"
            ordinal={Number(profile.doubles_ordinal)}
            games={profile.doubles_games}
            wins={profile.doubles_wins}
            losses={profile.doubles_losses} />
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Historial reciente</h2>
        {history && history.length > 0 ? (
          <ul className="divide-y divide-border">
            {history.map((r: any) => {
              const won = r.rank === 1;
              const delta = Number(r.mu_after) - Number(r.mu_before);
              return (
                <li key={`${r.match_id}-${r.team}`} className="py-3 flex items-center justify-between">
                  <Link href={`/matches/${r.match_id}`} className="hover:text-primary">
                    {r.matches?.format === "singles" ? "Singles" : "Parejas"} a {r.matches?.target_points} · {new Date(r.created_at).toLocaleDateString("es")}
                  </Link>
                  <div className="flex items-center gap-3 text-sm">
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

function Block({ title, ordinal, games, wins, losses }: {
  title: string; ordinal: number; games: number; wins: number; losses: number;
}) {
  return (
    <div className="bg-surface-2 rounded-md p-4">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="text-3xl font-bold text-primary font-mono mt-1">
        {games > 0 ? ordinal.toFixed(1) : "—"}
      </div>
      <div className="text-sm text-text-dim mt-1">
        {games} partidas · <span className="text-primary">{wins}G</span>-<span className="text-danger">{losses}P</span>
      </div>
    </div>
  );
}
