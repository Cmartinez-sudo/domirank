'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startTournament, generateNextRound } from '@/lib/club-pro/tournament-actions';

export function StartTournamentButton({
  orgSlug,
  tournamentId,
}: {
  orgSlug: string;
  tournamentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    setError(null);
    if (!confirm('¿Iniciar el torneo? Se generarán los pairings de la Ronda 1.')) return;
    startTransition(async () => {
      const result = await startTournament({ orgSlug, tournamentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        {isPending ? 'Iniciando…' : 'Iniciar torneo'}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function GenerateNextRoundButton({
  orgSlug,
  tournamentId,
}: {
  orgSlug: string;
  tournamentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    setError(null);
    if (!confirm('¿Generar la siguiente ronda? Se calcularán los pairings.')) return;
    startTransition(async () => {
      const result = await generateNextRound({ orgSlug, tournamentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {isPending ? 'Generando…' : 'Generar siguiente ronda'}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
