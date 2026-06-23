import Link from "next/link";
import { TierBadge } from "@/components/RatingInfo";
import type { ModalityRow } from "@/lib/profile";

type Variant = "compact" | "detailed";

type Props = {
  modality: ModalityRow;
  /** When true and games=0, show the empty state with CTA (owner view). */
  isOwnView: boolean;
  /**
   * Layout density.
   *   - "compact" (default, used by profile): inline-flex stats row.
   *   - "detailed" (dashboard): grid-cols-3 row with Partidas / G·P / W%.
   */
  variant?: Variant;
};

/**
 * Per-modality card showing rating + tier + games breakdown, OR an
 * empty-state CTA when the user has not played in this modality yet.
 *
 * Used by /profile/[username] and /dashboard. Empty-state visibility
 * is decided upstream via `shouldShowModality` in src/lib/profile.ts.
 */
export function ModalityCard({ modality, isOwnView, variant = "compact" }: Props) {
  const { title, display, elo, games, wins, losses, emptyCopy, ctaSet } = modality;
  const hasGames = games > 0;

  if (!hasGames && isOwnView) {
    return <EmptyState title={title} emptyCopy={emptyCopy} ctaSet={ctaSet} />;
  }

  if (variant === "detailed") {
    return <DetailedCard title={title} display={display} elo={elo} games={games} wins={wins} losses={losses} />;
  }

  return <CompactCard title={title} display={display} elo={elo} games={games} wins={wins} losses={losses} />;
}

function CompactCard({ title, display, elo, games, wins, losses }: {
  title: string; display: number; elo: number; games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  const isProvisional = games > 0 && games < 10;
  return (
    <div className="bg-surface-2 rounded-md p-4">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-3xl font-bold text-primary font-mono tabular-nums leading-none">
          {games > 0 ? display.toFixed(1) : "—"}
        </span>
        {games > 0 && <TierBadge display={display} />}
        {isProvisional && (
          <span className="text-text-mute text-[10px] uppercase tracking-wider font-semibold">Provisional</span>
        )}
      </div>
      {games > 0 && <div className="text-text-mute text-xs mt-0.5">Elo {elo}</div>}
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

function DetailedCard({ title, display, elo, games, wins, losses }: {
  title: string; display: number; elo: number; games: number; wins: number; losses: number;
}) {
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  const isProvisional = games > 0 && games < 10;
  return (
    <div className="card">
      <div className="text-text-mute text-sm">{title}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-4xl font-bold text-primary font-mono tabular-nums leading-none">
          {games > 0 ? display.toFixed(1) : "—"}
        </span>
        {games > 0 && <TierBadge display={display} />}
        {isProvisional && (
          <span className="text-text-mute text-[10px] uppercase tracking-wider font-semibold">Provisional</span>
        )}
      </div>
      {games > 0 && <div className="text-text-mute text-xs mt-0.5">Elo {elo}</div>}
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <div>
          <div className="text-text-mute text-xs">Partidas</div>
          <div className="font-mono tabular-nums">{games}</div>
        </div>
        <div>
          <div className="text-text-mute text-xs">G / P</div>
          <div className="font-mono tabular-nums"><span className="text-primary">{wins}</span> <span className="text-text-mute">/</span> <span className="text-danger">{losses}</span></div>
        </div>
        <div>
          <div className="text-text-mute text-xs">W%</div>
          <div className="font-mono tabular-nums">{winRate !== null ? `${winRate}%` : "—"}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, emptyCopy, ctaSet }: {
  title: string;
  emptyCopy: string;
  ctaSet: "d6" | "d9";
}) {
  // Pre-select set via query param. Post-Fase-A: format siempre es 'doubles'.
  const href = `/matches/new?set=${ctaSet}`;
  return (
    <div className="bg-surface-2 rounded-md p-4 border border-dashed border-border">
      <div className="text-text-mute text-sm">{title}</div>
      <p className="text-text-dim text-sm mt-2">{emptyCopy}</p>
      <Link
        href={href}
        className="inline-flex items-center mt-3 text-primary text-sm font-medium hover:underline"
      >
        Jugar ahora →
      </Link>
    </div>
  );
}
