import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
import { getGroupDetails } from "@/lib/groups-queries";
import { computeStreak, type StreakResult } from "@/lib/group-streak";

export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────────

type LeaderboardRow = {
  group_id: string;
  user_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  effectiveness_coefficient: number;
  effectiveness_percent: number;
  points_for: number;
  points_against: number;
  diff: number;
  rank: number;
};

type PlayerProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type PlayerRating = {
  global_display: number | null;
  is_rated: boolean;
};

/**
 * Fila unificada usada para render — combina leaderboard stats, perfil,
 * rating global y racha. Para miembros sin partidas, todas las stats son 0
 * y `streak`/`displayRank` son null.
 */
type MergedRow = {
  user_id: string;
  profile: PlayerProfile;
  rating: PlayerRating;
  matches_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  effectiveness_coefficient: number;
  points_for: number;
  points_against: number;
  diff: number;
  streak: StreakResult | null;
  /** Rank a mostrar (1, 2, 3…) o null si no ha jugado — celda muestra "—". */
  displayRank: number | null;
  joined_at: string | null;
};

const MIN_MATCHES_FOR_AVG_HIGHLIGHT = 3;
const MIN_STREAK_FOR_HIGHLIGHT = 2;

// ─── Helpers de presentación ─────────────────────────────────────────────

function firstName(profile: PlayerProfile): string {
  if (profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim().split(/\s+/)[0]!;
  }
  return profile.username;
}

function formatDiff(diff: number): { text: string; positive: boolean } {
  if (diff === 0) return { text: "0", positive: false };
  if (diff > 0) return { text: `+${diff}`, positive: true };
  return { text: `${diff}`, positive: false };
}

function rankBadgeClasses(rank: number): string {
  if (rank === 1) return "bg-yellow-500 text-black";
  if (rank === 2) return "bg-slate-300 text-black";
  if (rank === 3) return "bg-orange-700 text-white";
  return "bg-slate-700 text-slate-300";
}

// ─── SVG icons inline (bullseye + flame) ─────────────────────────────────

function TargetIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default async function GroupLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    return await renderLeaderboard(await params);
  } catch (e) {
    // Debug: mostrar el error inline hasta que estabilice. TODO remove.
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[GroupLeaderboardPage] crash:", err);
    return (
      <div className="card border-red-500/40 bg-red-950/20 text-sm text-red-200 space-y-2">
        <div className="font-bold text-red-400">Debug: crash del leaderboard</div>
        <div className="font-mono text-xs whitespace-pre-wrap break-all">{err.message}</div>
        {err.stack && (
          <details>
            <summary className="cursor-pointer text-red-300 text-xs">stack</summary>
            <pre className="text-[10px] overflow-auto max-h-64 mt-1">{err.stack}</pre>
          </details>
        )}
      </div>
    );
  }
}

async function renderLeaderboard({ id }: { id: string }) {
  await requireUser();
  const group = await getGroupDetails(id);
  if (!group) notFound();

  const supabase = supabaseService();

  // 1) Filas de la leaderboard view (solo users que jugaron ≥1 partida).
  const { data: rowsRaw } = await supabase
    .from("group_leaderboard")
    .select("*")
    .eq("group_id", id);
  const leaderboardRows = (rowsRaw as LeaderboardRow[] | null) ?? [];
  const leaderboardByUser = new Map(leaderboardRows.map((r) => [r.user_id, r]));

  // 2) Ratings globales para todos los miembros (mismo patrón que /members).
  const memberUserIds = group.members.map((m) => m.user_id);
  const ratingMap = new Map<string, PlayerRating>();
  if (memberUserIds.length > 0) {
    const { data: ratings } = await supabase
      .from("profile_ratings")
      .select("id, global_display, is_rated")
      .in("id", memberUserIds);
    for (const r of (ratings ?? []) as Array<{ id: string; global_display: number | null; is_rated: boolean }>) {
      ratingMap.set(r.id, { global_display: r.global_display, is_rated: r.is_rated });
    }
  }

  // 3) Matches confirmados atribuidos al grupo — necesario para racha por user.
  //    Traemos solo los IDs de match del grupo, luego los match_players.
  const { data: attributions } = await supabase
    .from("group_match_attributions")
    .select("match_id")
    .eq("group_id", id);
  const matchIds = ((attributions as Array<{ match_id: string }> | null) ?? []).map((r) => r.match_id);

  const matchesByUser = new Map<string, Array<{ finished_at: string; rank: number | null }>>();
  if (matchIds.length > 0) {
    // match_players tiene rank; matches tiene finished_at + status. Solo confirmados.
    const { data: playersRaw } = await supabase
      .from("match_players")
      .select("user_id, rank, matches!inner(finished_at, status)")
      .in("match_id", matchIds);
    type PlayerRow = {
      user_id: string;
      rank: number | null;
      matches: { finished_at: string | null; status: string };
    };
    for (const p of (playersRaw as unknown as PlayerRow[] | null) ?? []) {
      if (p.matches?.status !== "confirmed") continue;
      if (!p.matches.finished_at) continue;
      const list = matchesByUser.get(p.user_id) ?? [];
      list.push({ finished_at: p.matches.finished_at, rank: p.rank });
      matchesByUser.set(p.user_id, list);
    }
  }

  // 4) Merge: para cada miembro activo, combinar stats + rating + racha.
  const merged: MergedRow[] = group.members.map((m) => {
    const stats = leaderboardByUser.get(m.user_id);
    const streak = computeStreak(matchesByUser.get(m.user_id) ?? []);
    return {
      user_id: m.user_id,
      profile: {
        username: m.username,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
      },
      rating: ratingMap.get(m.user_id) ?? { global_display: null, is_rated: false },
      matches_played: stats?.matches_played ?? 0,
      wins: stats?.wins ?? 0,
      losses: stats?.losses ?? 0,
      win_rate: Number(stats?.win_rate ?? 0),
      effectiveness_coefficient: Number(stats?.effectiveness_coefficient ?? 0),
      points_for: stats?.points_for ?? 0,
      points_against: stats?.points_against ?? 0,
      diff: stats?.diff ?? 0,
      streak,
      displayRank: stats ? stats.rank : null,
      joined_at: m.joined_at,
    };
  });

  // 5) Sort: los que jugaron por rank ASC (respetando SQL federado);
  //    los que no jugaron al final, ordenados por joined_at ASC.
  const ranked = merged
    .filter((r) => r.matches_played > 0)
    .sort((a, b) => (a.displayRank ?? 999) - (b.displayRank ?? 999));
  const unranked = merged
    .filter((r) => r.matches_played === 0)
    .sort((a, b) => (a.joined_at ?? "").localeCompare(b.joined_at ?? ""));
  const rows = [...ranked, ...unranked];

  // 6) Highlights: Mejor promedio (≥3 partidas) y En racha (≥2W activos).
  const bestAverage = ranked
    .filter((r) => r.matches_played >= MIN_MATCHES_FOR_AVG_HIGHLIGHT)
    .sort((a, b) => {
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
      return b.matches_played - a.matches_played;
    })[0];

  const bestStreak = ranked
    .filter(
      (r) =>
        r.streak &&
        r.streak.outcome === "W" &&
        r.streak.count >= MIN_STREAK_FOR_HIGHLIGHT,
    )
    .sort((a, b) => {
      const diff = (b.streak?.count ?? 0) - (a.streak?.count ?? 0);
      if (diff !== 0) return diff;
      return b.matches_played - a.matches_played;
    })[0];

  return (
    <div className="space-y-4">
      {/* ─── Highlights ─────────────────────────────────────── */}
      {(bestAverage || bestStreak) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bestAverage && (
            <HighlightCard
              icon={<TargetIcon className="text-yellow-500" />}
              label="Mejor promedio"
              row={bestAverage}
              stat={`${Math.round(bestAverage.win_rate)}% · ${bestAverage.matches_played} ${bestAverage.matches_played === 1 ? "partida" : "partidas"}`}
            />
          )}
          {bestStreak && bestStreak.streak && (
            <HighlightCard
              icon={<FlameIcon className="text-orange-500" />}
              label="En racha"
              row={bestStreak}
              stat={`${bestStreak.streak.count}W consecutivas`}
            />
          )}
        </div>
      )}

      {/* ─── Tabla principal ────────────────────────────────── */}
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-text-mute px-4">
            <p>Aún no hay miembros en el grupo.</p>
          </div>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-left text-text-mute text-xs uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 w-14">#</th>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-3 py-3 text-right" title="Victorias">V</th>
                <th className="px-3 py-3 text-right" title="Derrotas">D</th>
                <th className="px-3 py-3 text-right" title="Porcentaje de victorias">%</th>
                <th className="px-3 py-3 text-right" title="Coeficiente de Eficiencia (federado)">CE</th>
                <th className="px-3 py-3 text-right" title="Puntos a favor">PF</th>
                <th className="px-3 py-3 text-right" title="Puntos en contra">PC</th>
                <th className="px-3 py-3 text-right" title="Diferencia PF − PC">±</th>
                <th className="px-4 py-3 text-center">Racha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <LeaderboardRowView key={r.user_id} row={r} />
              ))}
            </tbody>
          </table>
        )}
        <p className="text-text-mute text-[11px] text-center py-3 border-t border-border/50">
          Orden: <span className="font-mono">V → CE → PF</span>
        </p>
      </div>
    </div>
  );
}

// ─── Row component ───────────────────────────────────────────────────────

function LeaderboardRowView({ row }: { row: MergedRow }) {
  const name = firstName(row.profile);
  const diffFmt = formatDiff(row.diff);
  const hasPlayed = row.matches_played > 0;

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/60 transition-colors">
      {/* # */}
      <td className="px-4 py-3">
        {row.displayRank ? (
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-base font-bold ${rankBadgeClasses(row.displayRank)}`}
          >
            {row.displayRank}
          </span>
        ) : (
          <span className="text-text-mute text-lg">—</span>
        )}
      </td>

      {/* Jugador */}
      <td className="px-4 py-3">
        <Link
          href={`/profile/${row.profile.username}`}
          className="flex items-center gap-3 hover:text-primary"
        >
          <Avatar player={row.profile} size={36} />
          <div className="min-w-0">
            <div className="font-semibold text-base leading-tight">{name}</div>
            <div className="text-text-mute text-xs mt-0.5">
              Global ·{" "}
              {row.rating.is_rated && row.rating.global_display != null
                ? row.rating.global_display
                : "—"}
            </div>
          </div>
        </Link>
      </td>

      {/* V */}
      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-emerald-400">
        {row.wins}
      </td>
      {/* D */}
      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">
        {row.losses}
      </td>
      {/* % */}
      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-text">
        {hasPlayed ? `${Math.round(row.win_rate)}%` : "—"}
      </td>
      {/* CE */}
      <td className="px-3 py-3 text-right font-mono tabular-nums text-text">
        {hasPlayed ? row.effectiveness_coefficient.toFixed(2) : "—"}
      </td>
      {/* PF */}
      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-text">
        {hasPlayed ? row.points_for : "—"}
      </td>
      {/* PC */}
      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">
        {hasPlayed ? row.points_against : "—"}
      </td>
      {/* ± */}
      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
        {hasPlayed ? (
          <span className={diffFmt.positive ? "text-emerald-400" : "text-red-400"}>
            {diffFmt.text}
          </span>
        ) : (
          <span className="text-text-mute">—</span>
        )}
      </td>
      {/* Racha */}
      <td className="px-4 py-3 text-center">
        {row.streak ? (
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold border ${
              row.streak.outcome === "W"
                ? "bg-emerald-950/50 text-emerald-400 border-emerald-500/30"
                : "bg-red-950/50 text-red-400 border-red-500/30"
            }`}
          >
            {row.streak.count}
            {row.streak.outcome}
          </span>
        ) : (
          <span className="text-text-mute">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Highlight card ──────────────────────────────────────────────────────

function HighlightCard({
  icon,
  label,
  row,
  stat,
}: {
  icon: React.ReactNode;
  label: string;
  row: MergedRow;
  stat: string;
}) {
  const name = firstName(row.profile);
  return (
    <Link
      href={`/profile/${row.profile.username}`}
      className="card flex items-center gap-4 hover:border-border-strong transition-colors"
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-text-mute text-xs uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <Avatar player={row.profile} size={40} />
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight truncate">{name}</div>
            <div className="text-text-dim text-sm">{stat}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
