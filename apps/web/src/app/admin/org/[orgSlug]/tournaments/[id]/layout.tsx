import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { TournamentTabs } from './TournamentTabs';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  registration: 'Registro abierto',
  ready: 'Listo',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  registration: 'bg-blue-100 text-blue-700',
  ready: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  finished: 'bg-slate-200 text-slate-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, id } = await params;
  const { org } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, status, rounds_count, current_round_number, display_slug',
    )
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();

  if (!tournament) notFound();

  return (
    <div className="space-y-4">
      <header>
        <Link
          href={`/admin/org/${org.slug}`}
          className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
        >
          ← {org.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${
              STATUS_BADGE[tournament.status] ?? STATUS_BADGE.draft
            }`}
          >
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </span>
          <span className="text-sm text-slate-500">
            Ronda {tournament.current_round_number ?? 0} / {tournament.rounds_count}
          </span>
        </div>
      </header>

      <TournamentTabs orgSlug={org.slug} tournamentId={tournament.id} />

      <div>{children}</div>
    </div>
  );
}
