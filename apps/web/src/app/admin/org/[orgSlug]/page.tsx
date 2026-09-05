import Link from 'next/link';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type OrgTournamentSummary = {
  id: string;
  name: string;
  status: string;
  rounds_count: number;
  current_round_number: number | null;
  scheduled_start_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  display_slug: string;
  pair_count: number;
};

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Admin · ${orgSlug} · DomiRank` };
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournamentsRaw } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, status, rounds_count, current_round_number, scheduled_start_at, started_at, finished_at, display_slug',
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  const tournaments = (tournamentsRaw ?? []) as Array<Omit<OrgTournamentSummary, 'pair_count'>>;

  // Pair counts in one batched query — avoid N+1.
  let pairCounts = new Map<string, number>();
  if (tournaments.length > 0) {
    const ids = tournaments.map((t) => t.id);
    const { data: pairsRaw } = await supabase
      .from('org_tournament_pairs')
      .select('tournament_id')
      .in('tournament_id', ids);
    for (const row of pairsRaw ?? []) {
      pairCounts.set(row.tournament_id, (pairCounts.get(row.tournament_id) ?? 0) + 1);
    }
  }

  const list: OrgTournamentSummary[] = tournaments.map((t) => ({
    ...t,
    pair_count: pairCounts.get(t.id) ?? 0,
  }));

  const canWrite = role === 'owner' || role === 'admin';
  const activeTournament = list.find((t) => t.status === 'in_progress');

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          {org.description && (
            <p className="mt-1 text-sm text-slate-600">{org.description}</p>
          )}
        </div>
        {canWrite && (
          <Link
            href={`/admin/org/${org.slug}/tournaments/new`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            aria-disabled={Boolean(activeTournament)}
            title={
              activeTournament
                ? 'Solo puede haber un torneo en curso por organización'
                : undefined
            }
          >
            Crear torneo
          </Link>
        )}
      </section>

      {activeTournament && (
        <section className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <strong>{activeTournament.name}</strong> está en curso —{' '}
          <Link
            href={`/admin/org/${org.slug}/tournaments/${activeTournament.id}`}
            className="underline"
          >
            gestionar
          </Link>
          .
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Torneos
        </h2>
        {list.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
            Todavía no hay torneos creados.
            {canWrite && (
              <>
                {' '}
                <Link
                  href={`/admin/org/${org.slug}/tournaments/new`}
                  className="font-medium text-slate-900 underline"
                >
                  Crear el primero
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/org/${org.slug}/tournaments/${t.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">
                        {t.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[t.status] ?? STATUS_BADGE.draft
                        }`}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.pair_count} {t.pair_count === 1 ? 'pareja' : 'parejas'}
                      {' · '}
                      Ronda {t.current_round_number ?? 0}/{t.rounds_count}
                      {' · '}
                      {t.status === 'finished'
                        ? `Finalizó ${formatDate(t.finished_at)}`
                        : t.status === 'in_progress'
                          ? `Inició ${formatDate(t.started_at)}`
                          : `Programado ${formatDate(t.scheduled_start_at)}`}
                    </div>
                  </div>
                  <span className="shrink-0 text-slate-300">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
