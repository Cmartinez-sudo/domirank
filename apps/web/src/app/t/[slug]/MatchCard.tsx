'use client';

/**
 * Single-match card for the public TV display.
 *
 * Design contract (see PR notes):
 *   - MESA N as a small top-left anchor (small label + tabular number).
 *   - Scores are the *hero* — sized ~3× the team-name text.
 *   - Leader (or final winner) is emerald + semibold; the other row muted.
 *   - Neutral treatment when scores are tied (only possible in-progress).
 *   - Finished cards get a single `opacity-70` on the shell so the eye
 *     naturally drifts to in-progress matches while finals remain readable.
 *   - Byes reuse the same shell with a BYE badge and a single team row.
 *
 * Colours use theme tokens (bg-surface / text-text / text-text-mute) so
 * the card follows the user's light/dark preference. The emerald leader
 * accent is theme-aware too — emerald-400 pops on dark, emerald-600 keeps
 * contrast on white in light mode.
 *
 * The component makes no assumptions about the surrounding grid — it
 * fills its parent cell via `h-full` and is safe inside CSS auto-fill or
 * fixed-column layouts.
 */

type MatchStatus = 'pending' | 'in_progress' | 'finished' | 'bye';

export type MatchCardProps = {
  tableNumber: number;
  homeName: string;
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
};

export function MatchCard({
  tableNumber,
  homeName,
  awayName,
  homeScore,
  awayScore,
  status,
}: MatchCardProps) {
  const isBye = status === 'bye' || awayName === null;
  const isFinished = status === 'finished';

  // Leader (or final winner) is whichever side has the higher score.
  // In-progress ties are neutral; finished matches never tie (DB rule).
  const home = homeScore ?? 0;
  const away = awayScore ?? 0;
  const homeLeads = homeScore !== null && awayScore !== null && home > away;
  const awayLeads = homeScore !== null && awayScore !== null && away > home;

  return (
    <article
      className={`flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-surface px-5 py-4 ring-1 ring-inset ring-border shadow-card ${
        isFinished ? 'opacity-70' : ''
      }`}
    >
      <TableHeader tableNumber={tableNumber} isBye={isBye} isFinished={isFinished} />

      {isBye ? (
        <div className="flex flex-1 flex-col justify-center gap-1">
          <span className="truncate text-[clamp(18px,1.6vw,28px)] font-semibold text-text">
            {homeName}
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-text-mute">
            Descansa esta ronda
          </span>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <TeamRow name={homeName} score={homeScore} highlight={homeLeads} />
          <TeamRow name={awayName ?? '—'} score={awayScore} highlight={awayLeads} />
        </div>
      )}
    </article>
  );
}

function TableHeader({
  tableNumber,
  isBye,
  isFinished,
}: {
  tableNumber: number;
  isBye: boolean;
  isFinished: boolean;
}) {
  return (
    <header className="flex items-baseline gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-mute">
        Mesa
      </span>
      <span className="font-mono text-[clamp(20px,1.8vw,32px)] font-semibold leading-none tabular-nums text-text">
        {tableNumber}
      </span>
      {isBye && (
        <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
          Bye
        </span>
      )}
      {isFinished && !isBye && (
        <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.15em] text-text-mute">
          · Final
        </span>
      )}
    </header>
  );
}

function TeamRow({
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
    <div className="flex min-w-0 items-baseline gap-4">
      <span
        className={`min-w-0 flex-1 truncate text-[clamp(18px,1.8vw,36px)] leading-tight ${
          highlight ? 'font-bold text-text' : 'font-semibold text-text-mute'
        }`}
      >
        {name}
      </span>
      <span
        className={`shrink-0 font-mono text-[clamp(44px,5vw,88px)] font-bold leading-none tabular-nums ${
          highlight
            ? 'text-emerald-600 dark:text-emerald-400'
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
