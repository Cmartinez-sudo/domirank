import Link from "next/link";
import { requireUser, getCurrentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { globalRating, DOMIRANK_MIN_GAMES, DEFAULT_MU, DEFAULT_SIGMA } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const profile: any = await getCurrentProfile();
  if (!profile) return <p>No se pudo cargar tu perfil.</p>;

  const gr = globalRating({
    d6_singles: { mu: Number(profile.singles_mu), sigma: Number(profile.singles_sigma) },
    d6_doubles: { mu: Number(profile.doubles_mu), sigma: Number(profile.doubles_sigma) },
    d9_singles: {
      mu: Number(profile.d9_singles_mu ?? DEFAULT_MU),
      sigma: Number(profile.d9_singles_sigma ?? DEFAULT_SIGMA),
    },
    d9_doubles: {
      mu: Number(profile.d9_doubles_mu ?? DEFAULT_MU),
      sigma: Number(profile.d9_doubles_sigma ?? DEFAULT_SIGMA),
    },
  });
  const totalGames =
    (profile.singles_games || 0) + (profile.doubles_games || 0) +
    (profile.d9_singles_games || 0) + (profile.d9_doubles_games || 0);
  const qualified = totalGames >= DOMIRANK_MIN_GAMES;

  const supabase = await supabaseServer();
  const { data: recent } = await supabase
    .from("match_players")
    .select("match_id, team, rank, mu_before, mu_after, sigma_before, sigma_after, created_at, matches(format, target_points, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const singlesOrdinal = Number(profile.singles_mu) - 3 * Number(profile.singles_sigma);
  const doublesOrdinal = Number(profile.doubles_mu) - 3 * Number(profile.doubles_sigma);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hola, {profile.display_name || profile.username}</h1>
          <p className="text-text-dim">@{profile.username}</p>
        </div>
        <Link href="/matches/new" className="btn-primary">+ Nueva partida</Link>
      </div>

      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,.08), rgba(59,130,246,.05))",
          borderColor: "rgba(16,185,129,.2)",
        }}
      >
        <div className="text-text-mute text-xs uppercase tracking-wider">DomiRank Global</div>
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
            }}
          >
            {qualified ? gr.ordinal.toFixed(1) : "—"}
          </span>
          {qualified ? (
            <span className="text-text-mute text-sm">
              rating · μ {gr.mu.toFixed(2)} · σ {gr.sigma.toFixed(2)}
            </span>
          ) : (
            <span className="text-text-mute text-sm">
              faltan {DOMIRANK_MIN_GAMES - totalGames} partidas para calificar
            </span>
          )}
        </div>
        <div className="text-text-dim text-sm mt-2">
          {totalGames} partidas totales · ponderado por certeza (1/σ²) ·{" "}
          <Link href="/como-funciona" className="text-primary hover:underline">
            ver cómo se calcula
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RatingCard
          title="Singles (1v1)"
          ordinal={singlesOrdinal}
          mu={Number(profile.singles_mu)}
          sigma={Number(profile.singles_sigma)}
          games={profile.singles_games}
          wins={profile.singles_wins}
          losses={profile.singles_losses}
        />
        <RatingCard
          title="Parejas (2v2)"
          ordinal={doublesOrdinal}
          mu={Number(profile.doubles_mu)}
          sigma={Number(profile.doubles_sigma)}
          games={profile.doubles_games}
          wins={profile.doubles_wins}
          losses={profile.doubles_losses}
        />
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Tus últimas partidas</h2>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-border">
            {recent.map((r: any) => {
              const won = r.rank === 1;
              const delta = Number(r.mu_after) - Number(r.mu_before);
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
                  <div className="flex items-center gap-3 text-sm flex-shrink-0">
                    <span className={`badge ${won ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                      {won ? "Ganó" : "Perdió"}
                    </span>
                    <span className={`font-mono ${delta >= 0 ? "text-primary" : "text-danger"}`}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(2)} μ
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-10">
            <div className="text-5xl mb-3 select-none">🎲</div>
            <p className="text-text-dim font-medium mb-1">Aún no has jugado ninguna partida.</p>
            <p className="text-text-mute text-sm mb-5">Registra tu primera partida y empieza a construir tu DomiRank.</p>
            <Link href="/matches/new" className="btn-primary">+ Nueva partida</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingCard({ title, ordinal, mu, sigma, games, wins, losses }: {
  title: string; ordinal: number; mu: number; sigma: number;
  games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  return (
    <div className="card">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-4xl font-bold text-primary font-mono">{games > 0 ? ordinal.toFixed(1) : "—"}</span>
        {games > 0 && <span className="text-text-mute text-sm">rating</span>}
      </div>
      <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
        <div>
          <div className="text-text-mute text-xs">μ</div>
          <div className="font-mono">{mu.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-text-mute text-xs">σ</div>
          <div className="font-mono">{sigma.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-text-mute text-xs">Partidas</div>
          <div className="font-mono">{games}</div>
        </div>
        <div>
          <div className="text-text-mute text-xs">W%</div>
          <div className="font-mono">{winRate !== null ? `${winRate}%` : "—"}</div>
        </div>
      </div>
      <div className="mt-3 text-sm">
        <span className="text-primary">{wins}G</span>
        <span className="text-text-mute"> · </span>
        <span className="text-danger">{losses}P</span>
      </div>
    </div>
  );
}
