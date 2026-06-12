'use client';

import { useEffect, useState } from 'react';

/**
 * Server-driven timer for the public display TV. Reads round.started_at +
 * tournament.round_duration_minutes and ticks once per second client-side.
 *
 * Drift across screens is bounded by Date.now() variance (~1s typically),
 * which is acceptable for a venue display. There's no pause concept in v1
 * — if the admin needs to pause, they can extend the round duration by
 * editing the tournament settings (Phase 3e/future).
 */
export function RoundTimer({
  startedAt,
  durationMinutes,
}: {
  startedAt: string;
  durationMinutes: number;
}) {
  const targetMs = new Date(startedAt).getTime() + durationMinutes * 60_000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, targetMs - now);
  const isExpired = remainingMs === 0;
  const isWarning = remainingMs > 0 && remainingMs < 5 * 60_000;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="text-right">
      <div className="text-[0.75vw] uppercase tracking-widest text-slate-400">
        {isExpired ? 'Tiempo' : 'Tiempo restante'}
      </div>
      <div
        className={`font-mono text-[2.4vw] font-bold leading-none tabular-nums ${
          isExpired
            ? 'text-red-500'
            : isWarning
              ? 'text-amber-400'
              : 'text-white'
        }`}
      >
        {isExpired ? '00:00' : mmss}
      </div>
    </div>
  );
}
