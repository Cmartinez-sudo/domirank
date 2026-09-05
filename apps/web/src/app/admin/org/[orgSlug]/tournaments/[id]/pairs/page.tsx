import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import {
  formatPairName,
  isIndividualFormat,
  labelsForFormat,
} from '@/lib/club-pro/pair-display';
import { WithdrawButton } from './WithdrawButton';

export const dynamic = 'force-dynamic';

type PairSummary = {
  id: string;
  player_a_name: string;
  player_a_email: string;
  player_b_name: string | null;
  player_b_email: string | null;
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
    .select('id, status, format')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const labels = labelsForFormat(tournament.format);
  const isIndividual = isIndividualFormat(tournament.format);

  const { data: pairsRaw } = await supabase
    .from('org_tournament_pairs')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('initial_seed', { ascending: true, nullsFirst: false });

  const pairs = (pairsRaw ?? []) as PairSummary[];

  // Map invited emails to invitation status (sent_at, opened_at, claimed_at).
  const { data: invitationsRaw } = await supabase
    .from('org_tournament_invitations')
    .select('email, sent_at, opened_at, claimed_at')
    .eq('tournament_id', tournament.id);
  const invitations = new Map<string, { sent_at: string; opened_at: string | null; claimed_at: string | null }>();
  for (const inv of invitationsRaw ?? []) {
    invitations.set(inv.email.toLowerCase(), {
      sent_at: inv.sent_at,
      opened_at: inv.opened_at,
      claimed_at: inv.claimed_at,
    });
  }

  const canWrite = role === 'owner' || role === 'admin';
  const canWithdraw = canWrite && tournament.status === 'in_progress';

  const activeCount = pairs.filter((p) => p.withdrawn_at === null).length;
  const totalLabel = pairs.length === 1 ? labels.singular : labels.plural;
  const activeAdj = isIndividual ? 'activos' : 'activas';
  const withdrawnLabel = isIndividual ? 'Retirado' : 'Retirada';
  const emptyMessage = `Sin ${labels.plural} registrados todavía.`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {pairs.length} {totalLabel} — {activeCount} {activeAdj}.
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
                      {formatPairName(p)}
                    </span>
                    {isWithdrawn && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {withdrawnLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <PlayerInviteStatus
                      email={p.player_a_email}
                      invitation={invitations.get(p.player_a_email.toLowerCase())}
                    />
                    {p.player_b_email && (
                      <PlayerInviteStatus
                        email={p.player_b_email}
                        invitation={invitations.get(p.player_b_email.toLowerCase())}
                      />
                    )}
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
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function PlayerInviteStatus({
  email,
  invitation,
}: {
  email: string;
  invitation?: { sent_at: string; opened_at: string | null; claimed_at: string | null };
}) {
  let badge: React.ReactNode = null;
  if (!invitation) {
    badge = <span className="text-amber-700">⏳ sin invitación</span>;
  } else if (invitation.claimed_at) {
    badge = <span className="text-emerald-700">✓ activó</span>;
  } else if (invitation.opened_at) {
    badge = <span className="text-blue-700">✉ abierta</span>;
  } else {
    badge = <span className="text-slate-500">✉ enviada</span>;
  }
  return (
    <span>
      {email} {badge}
    </span>
  );
}
