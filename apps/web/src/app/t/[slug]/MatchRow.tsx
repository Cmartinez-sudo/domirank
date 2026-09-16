'use client';

import type { MatchCardProps } from './MatchCard';

/**
 * Compact list-row for the TV display, used when there are too many
 * matches to fit the card grid in a single page.
 *
 * Layout mirrors `MatchCard` at a smaller scale (same mental model,
 * different density):
 *   ┌──────┬─────────────────────┬────┐
 *   │ MESA │  Home team          │ 98 │  ← leader emerald + bold
 *   │  5   │  Away team          │ 76 │  ← muted
 *   └──────┴─────────────────────┴────┘
 *
 * The MESA anchor stays prominent so players can still search visually.
 * Score is smaller than card mode but still tabular + bold for the leader.
 *
 * Uses theme tokens (bg-surface / text-text / text-text-mute) so the row
 * follows the user's light/dark preference. Leader emerald shifts shade
 * between themes for readability.
 */
export function MatchRow({
  tableNumber,
  homeName,
  awayName,
  homeScore,
  awayScore,
  status,
}: MatchCardProps) {
  const isBye = status === 'bye' || awayName === null;
  const isFinished = status === 'finished';

  const home = homeScore ?? 0;
  const away = awayScore ?? 0;
  const homeLeads = homeScore !== null && awayScore !== null && home > away;
  const awayLeads = homeScore !== null && awayScore !== null && away > home;

  return (
    <div
      className={`flex items-stretch gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-inset ring-border ${
        isFinished ? 'opacity-70' : ''
      }`}
    >
      {/* Mesa anchor — vertical block on the left */}
      <div className="flex w-[clamp(48px,4vw,72px)] shrink-0 flex-col items-center justify-center border-r border-border pr-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-mute">
          Mesa
        </span>
        <span className="font-mono text-[clamp(18px,1.6vw,28px)] font-semibold leading-none tabular-nums text-text">
          {tableNumber}
        </span>
      </div>

      {/* Rows: home + away (or single row for byes) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        {isBye ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[clamp(13px,1.1vw,18px)] font-medium text-text">
              {homeName}
            </span>
            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-text-dim">
              Bye
            </span>
          </div>
        ) : (
          <>
            <RowLine name={homeName} score={homeScore} highlight={homeLeads} />
            <RowLine name={awayName ?? '—'} score={awayScore} highlight={awayLeads} />
          </>
        )}
      </div>
    </div>
  );
}

function RowLine({
  name,
  score,
  highlight,
}: {
  name: string;
  score: number | null;
  highlight: boolean;
}) {
  const scoreDisplay = score === null ? '—' : String(score);
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <span
        className={`min-w-0 flex-1 truncate text-[clamp(13px,1.1vw,18px)] leading-tight ${
          highlight ? 'font-semibold text-text' : 'font-medium text-text-mute'
        }`}
      >
        {name}
      </span>
      <span
        className={`shrink-0 font-mono text-[clamp(20px,1.8vw,30px)] font-bold leading-none tabular-nums ${
          highlight
            ? 'text-emerald-500 dark:text-emerald-400'
            : score === null
              ? 'text-text-mute/60'
              : 'text-text-mute'
        }`}
      >
        {scoreDisplay}
      </span>
    </div>
  );
}
