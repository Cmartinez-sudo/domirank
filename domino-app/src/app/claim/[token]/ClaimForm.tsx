'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { claimInvitation, signInAfterClaim } from '@/lib/club-pro/claim-actions';

export function ClaimForm({
  token,
  email,
  tournamentId,
}: {
  token: string;
  email: string;
  tournamentId: string;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    startTransition(async () => {
      const claim = await claimInvitation({ token, password });
      if (!claim.ok) {
        setError(claim.error);
        return;
      }

      // Sign in the new user with the password they just set.
      const signIn = await signInAfterClaim(email, password);
      if (!signIn.ok) {
        // Account created but auto-login failed — push them to /login.
        router.push('/login?claimed=1');
        return;
      }

      router.push(`/tournaments/club-pro/${claim.tournamentId}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Confirmar contraseña
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {isPending ? 'Activando…' : 'Activar mi cuenta'}
      </button>
      <p className="text-center text-xs text-slate-500">
        Al activar aceptás los{' '}
        <a href="/terms" className="underline">
          términos
        </a>{' '}
        y la{' '}
        <a href="/privacy" className="underline">
          política de privacidad
        </a>
        .
      </p>
    </form>
  );
}
