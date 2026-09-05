'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendTournamentInvitations } from '@/lib/club-pro/tournament-actions';

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; sent: number; skipped: number; failed: number; failures: string[] }
  | { kind: 'error'; message: string };

export function SendInvitationsButton({
  orgSlug,
  tournamentId,
  pendingCount,
}: {
  orgSlug: string;
  tournamentId: string;
  pendingCount: number;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    setStatus({ kind: 'idle' });
    const ok = confirm(
      `Vas a enviar invitaciones a ${pendingCount} jugadores. Solo se invita a quienes todavía no recibieron email. ¿Continuar?`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await sendTournamentInvitations({ orgSlug, tournamentId });
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error });
        return;
      }
      setStatus({
        kind: 'success',
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
        failures: result.failures,
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || pendingCount === 0}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {isPending ? 'Enviando…' : `Enviar invitaciones (${pendingCount} pendientes)`}
      </button>
      {status.kind === 'error' && (
        <p className="text-xs text-red-700">{status.message}</p>
      )}
      {status.kind === 'success' && (
        <div className="text-xs">
          <p className="text-emerald-700">
            ✓ {status.sent} enviado{status.sent === 1 ? '' : 's'}.{' '}
            {status.skipped > 0 && <span>{status.skipped} ya invitado{status.skipped === 1 ? '' : 's'}. </span>}
            {status.failed > 0 && (
              <span className="text-red-700">
                {status.failed} fallaron.
              </span>
            )}
          </p>
          {status.failures.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-red-700">Ver fallos</summary>
              <ul className="mt-1 space-y-0.5 text-red-700">
                {status.failures.map((f, i) => (
                  <li key={i}>· {f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
