'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markPairWithdrawn } from '@/lib/club-pro/tournament-actions';

export function WithdrawButton({
  orgSlug,
  pairId,
}: {
  orgSlug: string;
  pairId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    const reason = prompt(
      '¿Por qué se retira la pareja? (opcional, queda en el audit log)',
    );
    if (reason === null) return; // cancel
    setError(null);
    startTransition(async () => {
      const result = await markPairWithdrawn({ orgSlug, pairId, reason: reason || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
      >
        {isPending ? 'Retirando…' : 'Marcar retirada'}
      </button>
      {error && <p className="max-w-[180px] text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
