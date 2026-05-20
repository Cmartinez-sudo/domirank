import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { DOMIRANK_MIN_GAMES, toDisplayRating } from "@/lib/rating";
import { TierBadge } from "@/components/RatingInfo";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: top } = await supabase
    .from("profile_ratings")
    .select("username, display_name, avatar_url, global_ordinal, global_display, total_games")
    .gte("total_games", DOMIRANK_MIN_GAMES)
    .order("global_ordinal", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-10">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          DomiRank — el ranking oficial de dominó
        </h1>
        <p className="text-text-dim text-lg max-w-2xl mx-auto">
          Registra tus partidas y torneos. Tu rating <span className="text-primary font-medium">OpenSkill</span>{" "}
          (Plackett-Luce con aproximaciones Weng-Lin) refleja tu nivel real en singles y parejas.
        </p>
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <Link href="/login" className="btn-primary">Crear cuenta gratis</Link>
          <Link href="/leaderboard" className="btn-ghost">Ver ranking</Link>
          <Link href="/como-funciona" className="btn-ghost">Cómo funciona →</Link>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top 5 · DomiRank Global</h2>
          <Link href="/leaderboard" className="text-primary text-sm hover:underline">
            Ver completo →
          </Link>
        </div>
        {top && top.length > 0 ? (
          <ol className="space-y-2">
            {top.map((p, i) => (
              <li key={p.username} className="flex items-center justify-between p-3 bg-surface-2 rounded-md">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-text-mute w-6 text-right">{i + 1}</span>
                  <Avatar player={{ username: p.username, display_name: p.display_name, avatar_url: (p as any).avatar_url }} size={28} />
                  <Link href={`/profile/${p.username}`} className="font-medium hover:text-primary truncate">
                    {p.display_name || p.username}
                  </Link>
                  <span className="text-text-mute text-sm hidden sm:inline">@{p.username}</span>
                </div>
                <div className="flex items-center gap-3 text-sm flex-shrink-0">
                  <span className="text-text-dim">{p.total_games} p.</span>
                  <TierBadge display={Number((p as any).global_display ?? toDisplayRating(Number(p.global_ordinal)))} />
                  <span className="font-mono font-semibold text-primary">
                    {Number((p as any).global_display ?? toDisplayRating(Number(p.global_ordinal))).toFixed(1)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-text-mute">Aún nadie tiene {DOMIRANK_MIN_GAMES}+ partidas. Sé el primero.</p>
        )}
      </section>
    </div>
  );
}
