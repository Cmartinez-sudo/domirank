import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { WithdrawButton } from './WithdrawButton';

export const dynamic = 'force-dynamic';

type PairSummary = {
  id: string;
  player_a_name: string;
  player_a_email: string;
  player_b_name: string;
  player_b_email: string;
  initial_seed: number | null;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
};

export default async function PairsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const { data: pairsRaw } = await supabase
    .from('org_tournament_pairs')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('initial_seed', { ascending: true, nullsFirst: false });

  const pairs = (pairsRaw ?? []) as PairSummary[];
  const canWrite = role === 'owner' || role === 'admin';
  const canWithdraw = canWrite && tournament.status === 'in_progress';

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {pairs.length} {pairs.length === 1 ? 'pareja' : 'parejas'} —{' '}
        {pairs.filter((p) => p.withdrawn_at === null).length} activas.
      </p>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
        {pairs.map((p) => {
          const isWithdrawn = p.withdrawn_at !== null;
          return (
            <li
              key={p.id}
              className={`px-4 py-3 ${isWithdrawn ? 'bg-slate-50 opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      #{p.initial_seed ?? '?'}
                    </span>
                    <span className="font-medium text-slate-900">
                      {p.player_a_name} &amp; {p.player_b_name}
                    </span>
                    {isWithdrawn && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Retirada
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.player_a_email} · {p.player_b_email}
                  </div>
                  {isWithdrawn && p.withdrawn_reason && (
                    <div className="mt-1 text-xs italic text-slate-500">
                      Motivo: {p.withdrawn_reason}
                    </div>
                  )}
                </div>
                {canWithdraw && !isWithdrawn && (
                  <WithdrawButton orgSlug={orgSlug} pairId={p.id} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pairs.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Sin parejas registradas todavía.
        </div>
      )}
    </div>
  );
}
