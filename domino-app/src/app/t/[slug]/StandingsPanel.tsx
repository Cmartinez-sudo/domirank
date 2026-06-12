'use client';

import { useEffect, useRef } from 'react';
import type { PairStanding } from '@/lib/club-pro/swiss-types';

type PairMini = { id: string; player_a_name: string; player_b_name: string };

const VISIBLE_ROWS_BEFORE_SCROLL = 12;

/**
 * Standings panel for the public TV display. Shows 5 columns per pair:
 * Victorias, Derrotas, CE, Puntos a Favor, Puntos en Contra.
 *
 * Auto-scrolls when more than 12 pairs are present so the venue audience
 * can see all teams over time without manual interaction.
 */
export function StandingsPanel({
  standings,
  pairById,
}: {
  standings: PairStanding[];
  pairById: Map<string, PairMini>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const needsAutoScroll = standings.length > VISIBLE_ROWS_BEFORE_SCROLL;

  // Auto-scroll loop: smoothly walk top → bottom, pause briefly, then loop.
  useEffect(() => {
    if (!needsAutoScroll) return;
    const el = scrollRef.current;
    if (!el) return;

    let frameId = 0;
    let direction: 'down' | 'pause-bottom' | 'reset' | 'pause-top' = 'pause-top';
    let pauseUntil = performance.now() + 2_000;
    const stepPxPerFrame = 0.3; // ~18px/sec — slow, comfortable for TV reading

    function tick(now: number) {
      if (!el) return;
      if (direction === 'pause-top' || direction === 'pause-bottom') {
        if (now >= pauseUntil) {
          direction = direction === 'pause-top' ? 'down' : 'reset';
        }
      } else if (direction === 'down') {
        el.scrollTop += stepPxPerFrame;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          direction = 'pause-bottom';
          pauseUntil = now + 4_000;
        }
      } else if (direction === 'reset') {
        el.scrollTop = 0;
        direction = 'pause-top';
        pauseUntil = now + 2_000;
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [needsAutoScroll, standings.length]);

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <h2 className="text-sm uppercase tracking-widest text-slate-400">
        Clasificación
      </h2>
      <div className="flex items-center gap-3 rounded-md bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
        <span className="w-8 text-right">#</span>
        <span className="w-8" /> {/* medal slot */}
        <span className="flex-1">Pareja</span>
        <span className="w-12 text-center" title="Victorias">V</span>
        <span className="w-12 text-center" title="Derrotas">D</span>
        <span className="w-16 text-right" title="Coeficiente de Efectividad">CE</span>
        <span className="w-16 text-right" title="Puntos a favor">PF</span>
        <span className="w-16 text-right" title="Puntos en contra">PC</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-hidden">
        <ol className="space-y-2">
          {standings.map((s, idx) => {
            const p = pairById.get(s.pairId);
            const name = p ? `${p.player_a_name} & ${p.player_b_name}` : '?';
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
            return (
              <li
                key={s.pairId}
                className={`flex items-center gap-3 rounded-md px-4 py-3 ${
                  idx < 3 ? 'bg-slate-800' : 'bg-slate-900'
                } ${s.withdrawn ? 'opacity-40' : ''}`}
              >
                <span className="w-8 text-right font-mono text-base text-slate-400">
                  {idx + 1}
                </span>
                <span className="w-8 text-2xl">{medal}</span>
                <span className="flex-1 truncate text-lg font-semibold">{name}</span>
                <span className="w-12 text-center font-mono text-lg font-bold tabular-nums">
                  {s.wins}
                </span>
                <span className="w-12 text-center font-mono tabular-nums text-slate-400">
                  {s.losses}
                </span>
                <span className="w-16 text-right font-mono text-sm tabular-nums text-slate-400">
                  {s.effectivenessCoefficient.toFixed(2)}
                </span>
                <span className="w-16 text-right font-mono text-base font-semibold tabular-nums text-emerald-400">
                  {s.pointsScored}
                </span>
                <span className="w-16 text-right font-mono text-base tabular-nums text-red-400">
                  {s.pointsConceded}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="px-4 pt-2 text-xs uppercase tracking-wider text-slate-500">
        V: victorias · D: derrotas · CE: coef. efectividad · PF: puntos a favor
        · PC: puntos en contra
      </div>
    </section>
  );
}
