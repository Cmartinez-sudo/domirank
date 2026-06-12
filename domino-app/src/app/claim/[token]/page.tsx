import Link from 'next/link';
import { lookupInvitation } from '@/lib/club-pro/claim-actions';
import { ClaimForm } from './ClaimForm';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Activar mi cuenta · DomiRank',
  robots: { index: false, follow: false },
};

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await lookupInvitation(token);

  if (!result.ok) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">
            {result.error === 'already_claimed'
              ? 'Cuenta ya activada'
              : 'Invitación no encontrada'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{result.message}</p>
          {result.error === 'already_claimed' && (
            <Link
              href="/login"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Ir al login →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs uppercase tracking-widest text-slate-500">
          {result.tournament.organization_name}
        </div>
        <h1 className="mt-1 text-xl font-bold">
          Hola, {result.invitation.player_name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Estás invitado al torneo{' '}
          <strong>{result.tournament.name}</strong>.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Activá tu cuenta de DomiRank creando una contraseña.
        </p>

        <div className="mt-6">
          <ClaimForm
            token={token}
            email={result.invitation.email}
            tournamentId={result.tournament.id}
          />
        </div>
      </div>
    </div>
  );
}
