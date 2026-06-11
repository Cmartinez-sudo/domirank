'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordMatchScore } from '@/lib/club-pro/tournament-actions';

export function MatchScoreCard({
  orgSlug,
  matchId,
  tableNumber,
  status,
  homeName,
  awayName,
  homeScore,
  awayScore,
  targetPoints,
  canWrite,
}: {
  orgSlug: string;
  matchId: string;
  tableNumber: number;
  status: string;
  homeName: string;
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  targetPoints: number;
  canWrite: boolean;
}) {
  const isBye = awayName === null;
  const isFinished = status === 'finished';

  const [home, setHome] = useState<string>(homeScore === null ? '' : String(homeScore));
  const [away, setAway] = useState<string>(awayScore === null ? '' : String(awayScore));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const h = Number(home);
    const a = Number(away);
    if (!Number.isFinite(h) || !Number.isFinite(a)) {
      setError('Ingresá ambos puntajes');
      return;
    }
    startTransition(async () => {
      const result = await recordMatchScore({
        orgSlug,
        matchId,
        pairHomeScore: h,
        pairAwayScore: a,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (isBye) {
    return (
      <li className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-700">
          Bye
        </div>
        <div className="mt-1 font-medium">{homeName}</div>
        <div className="mt-1 text-xs text-amber-700">
          Recibe descanso esta ronda (+1 victoria, 0 tantos).
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-md border p-4 ${
        isFinished ? 'border-slate-200 bg-slate-50' : 'border-slate-300 bg-white'
      }`}
    >
      <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
        Mesa {tableNumber}
      </div>
      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-sm font-medium">{homeName}</span>
          <input
            type="number"
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={isFinished || !canWrite || isPending}
            min={0}
            max={999}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100"
            placeholder="—"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-sm font-medium">{awayName}</span>
          <input
            type="number"
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={isFinished || !canWrite || isPending}
            min={0}
            max={999}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100"
            placeholder="—"
          />
        </div>
        {!isFinished && canWrite && (
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : `Guardar (meta ${targetPoints})`}
          </button>
        )}
        {isFinished && (
          <div className="text-xs text-emerald-700">✓ Finalizada</div>
        )}
        {error && <div className="text-xs text-red-700">{error}</div>}
      </form>
    </li>
  );
}
