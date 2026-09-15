'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PairStanding } from '@/lib/club-pro/swiss-types';
import { formatPairName } from '@/lib/club-pro/pair-display';

type PairMini = { id: string; player_a_name: string; player_b_name: string | null };

/** Seconds each page stays visible before fading to the next. */
const PAGE_DURATION_MS = 7_000;
/** Approximate row height in pixels; used only as a coarse estimate to
 *  initialise pageSize before the first measurement. Real height is
 *  measured after mount.
 */
const ROW_HEIGHT_FALLBACK = 56;

/**
 * Standings panel for the public TV display.
 *
 * Behaviour:
 *   - Shows 5 stat columns per pair: V, D, CE, Efec, PF, PC.
 *   - Measures available height after layout to compute how many rows fit
 *     in one page. If everything fits → no pagination, all rows visible.
 *   - When pagination is enabled, cycles pages every 7s with a soft
 *     fade-in animation. Indicator "1/3" appears bottom-right.
 *
 * Sort order (NOT affected by Efec column) is decided by the caller —
 * canonically: wins → CE → pointsScored → head-to-head → pair.id.
 */
export function StandingsPanel({
  standings,
  pairById,
  isIndividual = false,
}: {
  standings: PairStanding[];
  pairById: Map<string, PairMini>;
  isIndividual?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  // Start with a generous default. ResizeObserver will overwrite this on
  // first paint based on the actual container height — the initial value
  // only matters for the first frame.
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);

  // Recompute pageSize whenever container or row dimensions change.
  // useLayoutEffect (not useEffect) so we measure before paint and avoid
  // a flash of the wrong page count.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const containerHeight = el.clientHeight;
      const rowH = rowRef.current?.clientHeight ?? ROW_HEIGHT_FALLBACK;
      // Add some gap allowance — rows use space-y-1.5 (6px).
      const rowWithGap = rowH + 6;
      const fitting = Math.max(1, Math.floor(containerHeight / rowWithGap));
      setPageSize(fitting);
    });
    observer.observe(el);
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  const totalPages = Math.max(1, Math.ceil(standings.length / pageSize));
  const paginationEnabled = standings.length > pageSize;

  // Auto-rotate pages when pagination is enabled.
  useEffect(() => {
    if (!paginationEnabled) {
      setPage(0);
      return;
    }
    const interval = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, PAGE_DURATION_MS);
    return () => clearInterval(interval);
  }, [paginationEnabled, totalPages]);

  // If the standings length changes (e.g. a pair was added/withdrawn live)
  // and the current page is now out of range, snap back to 0. Gives a
  // "live update arrived" feel that matches broadcast UX.
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const start = page * pageSize;
  const end = start + pageSize;
  const visible = paginationEnabled ? standings.slice(start, end) : standings;

  return (
    <section className="relative flex min-h-0 flex-col gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-mute">
        Clasificación
      </h2>
      <div className="flex shrink-0 items-center gap-3 rounded-xl bg-surface/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] ring-1 ring-inset ring-border">
        <span className="w-10 text-right text-text-mute">#</span>
        <span className="w-8" /> {/* medal slot */}
        <span className="flex-1 text-text-dim">
          {isIndividual ? 'Jugador' : 'Pareja'}
        </span>
        {/* Primary stats — same weight as pair column, drive sort order */}
        <span className="w-12 text-center text-text-dim" title="Victorias">V</span>
        <span className="w-12 text-center text-text-dim" title="Derrotas">D</span>
        <span className="w-14 text-right text-text-dim" title="Coeficiente de Efectividad">CE</span>
        {/* Secondary stats — muted, contextual only */}
        <span className="w-16 text-right text-text-mute/70" title="Efectividad %">Efec</span>
        <span className="w-14 text-right text-text-mute/70" title="Puntos a favor">PF</span>
        <span className="w-14 text-right text-text-mute/70" title="Puntos en contra">PC</span>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-hidden">
        <ol
          key={page /* re-mount on page change so fade re-triggers */}
          className="space-y-1.5 animate-fade-in"
        >
          {visible.map((s, idx) => {
            const p = pairById.get(s.pairId);
            const name = formatPairName(p);
            const absoluteRank = start + idx;
            const medal =
              absoluteRank === 0 ? '🥇' : absoluteRank === 1 ? '🥈' : absoluteRank === 2 ? '🥉' : '';
            const isPodium = absoluteRank < 3;
            return (
              <li
                key={s.pairId}
                ref={idx === 0 ? rowRef : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-[clamp(10px,1.4vh,18px)] ring-1 ring-inset ring-border ${
                  isPodium ? 'bg-surface-2 shadow-card' : 'bg-surface/60'
                } ${s.withdrawn ? 'opacity-40' : ''}`}
              >
                <span
                  className={`w-10 text-right font-mono text-lg font-semibold tabular-nums ${
                    isPodium ? 'text-text' : 'text-text-mute'
                  }`}
                >
                  {absoluteRank + 1}
                </span>
                <span className="w-8 text-xl leading-none">{medal}</span>
                <span
                  className={`flex-1 truncate text-base font-medium ${
                    isPodium ? 'text-text' : 'text-text-dim'
                  }`}
                >
                  {name}
                </span>
                {/* Primary stats — full size, tabular, prominent */}
                <span
                  className={`w-12 text-center font-mono text-lg font-semibold tabular-nums ${
                    s.wins > 0 ? 'text-text' : 'text-text-dim'
                  }`}
                >
                  {s.wins}
                </span>
                <span className="w-12 text-center font-mono text-lg tabular-nums text-text-dim">
                  {s.losses}
                </span>
                <span className="w-14 text-right font-mono text-base font-medium tabular-nums text-text-dim">
                  {s.effectivenessCoefficient.toFixed(2)}
                </span>
                {/* Secondary stats — small + muted */}
                <span className="w-16 text-right font-mono text-xs tabular-nums text-text-mute">
                  {s.effectivenessPercent.toFixed(1)}%
                </span>
                <span className="w-14 text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400/80">
                  {s.pointsScored}
                </span>
                <span className="w-14 text-right font-mono text-xs tabular-nums text-danger/80">
                  {s.pointsConceded}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex shrink-0 items-center justify-between px-4 pt-2 text-[10px] uppercase tracking-[0.15em] text-text-mute/70">
        <span>
          V: victorias · D: derrotas · CE: coef. efectividad · Efec: % · PF / PC: puntos
        </span>
        {paginationEnabled && (
          <span className="font-mono tabular-nums text-text-mute">
            {page + 1}/{totalPages}
          </span>
        )}
      </div>
    </section>
  );
}
