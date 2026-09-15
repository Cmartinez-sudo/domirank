'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MatchCard, type MatchCardProps } from './MatchCard';
import { MatchRow } from './MatchRow';

/** Seconds each list page stays visible before rotating. */
const PAGE_DURATION_MS = 7_000;
/** Card mode grid: `grid-template-columns: repeat(auto-fill, minmax(CARD_MIN_PX, 1fr))`. */
const CARD_MIN_PX = 360;
/** Row/column gap in px. Matches Tailwind `gap-3`. */
const GAP_PX = 12;
/** Floor on card height so the score-hero typography (~64px) always fits. */
const CARD_MIN_HEIGHT_PX = 180;
/** Approximate compact list-row height. Coarse — refined by measurement. */
const LIST_ROW_FALLBACK_PX = 68;

type Match = MatchCardProps & { id: string };

/**
 * Matches panel for the public TV display.
 *
 * Renders in ONE of two modes, decided by fit:
 *
 *  - **card mode** — auto-fill grid of hero-score cards. Used when every
 *    match fits in a single "page" at the current viewport. No pagination,
 *    no rotation, static display.
 *
 *  - **list mode** — compact rows (Mesa anchor + two team lines with score)
 *    when the cards would need to paginate. Denser: fits 15–20 matches in
 *    one page. Still rotates every 7s if it OVERFLOWS this denser layout
 *    (rare — happens ~25+ matches).
 *
 * The switch is instantaneous (no cross-fade) since the observer only
 * fires on real layout changes, not per-frame.
 */
export function MatchesPanel({
  matches,
  emptyLabel = 'Esperando inicio de la ronda…',
}: {
  matches: Match[];
  emptyLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const probeCardRef = useRef<HTMLDivElement>(null);
  const probeRowRef = useRef<HTMLDivElement>(null);

  // Fit numbers get filled in by the observer on mount + on resize.
  const [cardCols, setCardCols] = useState(2);
  const [cardRows, setCardRows] = useState(2);
  const [listRows, setListRows] = useState(6);

  const [page, setPage] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      // The grid uses `minmax(CARD_MIN_HEIGHT_PX, 1fr)` so the effective
      // row height is the LARGER of the probe's natural height and the
      // configured floor. Using the raw probe height alone under-counts,
      // and mode falsely stays in cards when it should switch to list.
      const cardH = Math.max(
        probeCardRef.current?.clientHeight ?? 0,
        CARD_MIN_HEIGHT_PX,
      );
      const rowH = probeRowRef.current?.clientHeight ?? LIST_ROW_FALLBACK_PX;

      const fittingCardCols = Math.max(
        1,
        Math.floor((width + GAP_PX) / (CARD_MIN_PX + GAP_PX)),
      );
      const fittingCardRows = Math.max(
        1,
        Math.floor((height + GAP_PX) / (cardH + GAP_PX)),
      );
      const fittingListRows = Math.max(
        1,
        Math.floor((height + GAP_PX) / (rowH + GAP_PX)),
      );

      setCardCols(fittingCardCols);
      setCardRows(fittingCardRows);
      setListRows(fittingListRows);
    };
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    if (probeCardRef.current) observer.observe(probeCardRef.current);
    if (probeRowRef.current) observer.observe(probeRowRef.current);
    recompute();
    return () => observer.disconnect();
  }, [matches.length]);

  const cardsPerPage = Math.max(1, cardCols * cardRows);
  const cardsFitInOnePage = matches.length <= cardsPerPage;

  // List mode is used ONLY when cards would need to paginate.
  const mode: 'cards' | 'list' = cardsFitInOnePage ? 'cards' : 'list';

  const pageSize = mode === 'cards' ? matches.length : listRows;
  const totalPages = Math.max(1, Math.ceil(matches.length / Math.max(1, pageSize)));
  // Only paginate in list mode when even the dense list overflows.
  const paginate = mode === 'list' && matches.length > listRows;

  useEffect(() => {
    if (!paginate) {
      setPage(0);
      return;
    }
    const interval = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, PAGE_DURATION_MS);
    return () => clearInterval(interval);
  }, [paginate, totalPages]);

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  if (matches.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-slate-900/40 text-lg text-slate-500 ring-1 ring-inset ring-white/5">
        {emptyLabel}
      </div>
    );
  }

  const start = paginate ? page * pageSize : 0;
  const visible = paginate ? matches.slice(start, start + pageSize) : matches;

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
      {/* Off-screen probes: measure real heights of one card and one row so
          the fit math stays accurate as the viewport / clamp values change.
          Absolute-positioned off-screen so they never affect layout but
          still receive a real width for measurement to be meaningful. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] top-0"
        style={{ width: `${CARD_MIN_PX}px` }}
      >
        <div ref={probeCardRef}>
          <MatchCard
            tableNumber={0}
            homeName="Probe"
            awayName="Probe"
            homeScore={0}
            awayScore={0}
            status="in_progress"
          />
        </div>
        <div ref={probeRowRef}>
          <MatchRow
            tableNumber={0}
            homeName="Probe"
            awayName="Probe"
            homeScore={0}
            awayScore={0}
            status="in_progress"
          />
        </div>
      </div>

      {mode === 'cards' ? (
        <div
          className="grid min-h-0 flex-1 gap-3 overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN_PX}px, 1fr))`,
            gridAutoRows: `minmax(${CARD_MIN_HEIGHT_PX}px, 1fr)`,
            alignContent: 'start',
          }}
        >
          {visible.map((m) => (
            <MatchCard key={m.id} {...m} />
          ))}
        </div>
      ) : (
        <ol
          key={page /* re-mount on page turn so fade re-triggers */}
          className="animate-fade-in flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
        >
          {visible.map((m) => (
            <li key={m.id} className="min-h-0">
              <MatchRow {...m} />
            </li>
          ))}
        </ol>
      )}

      {paginate && (
        <div className="pointer-events-none absolute bottom-1 right-2 font-mono text-[11px] uppercase tracking-wider tabular-nums text-slate-500">
          {page + 1}/{totalPages}
        </div>
      )}
    </div>
  );
}
