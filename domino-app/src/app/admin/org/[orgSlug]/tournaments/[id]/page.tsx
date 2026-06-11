import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  registration: 'Registro abierto',
  ready: 'Listo',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Torneo · ${orgSlug} · Admin · DomiRank` };
}

/**
 * Placeholder for the tournament management screen. The full page with
 * tabs (Overview, Pairs, Rounds, Standings, Settings) + server actions
 * for score entry / round generation lives in Phase 3c.
 *
 * For now, this page just shows that the tournament was successfully
 * created — it's where Phase 3b's wizard redirects to.
 */
export default async function TournamentManagementPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, description, prize_description, status, rounds_count, current_round_number, round_duration_minutes, target_points, scheduled_start_at, display_slug',
    )
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();

  if (!tournament) notFound();

  const { count: pairCount } = await supabase
    .from('org_tournament_pairs')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/admin/org/${org.slug}`}
          className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
        >
          ← {org.name}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </span>
        </div>
        {tournament.description && (
          <p className="mt-1 text-sm text-slate-600">{tournament.description}</p>
        )}
      </header>

      <section className="rounded-md border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Resumen
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Parejas:</dt>
          <dd className="font-medium">{pairCount ?? 0}</dd>
          <dt className="text-slate-500">Rondas:</dt>
          <dd className="font-medium">
            {tournament.current_round_number ?? 0} / {tournament.rounds_count}
          </dd>
          <dt className="text-slate-500">Duración por ronda:</dt>
          <dd className="font-medium">{tournament.round_duration_minutes} min</dd>
          <dt className="text-slate-500">Meta de tantos:</dt>
          <dd className="font-medium">{tournament.target_points}</dd>
          <dt className="text-slate-500">Display slug:</dt>
          <dd className="font-mono text-xs">{tournament.display_slug}</dd>
        </dl>
      </section>

      <section className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        <strong>Próximamente:</strong> tabs de gestión (parejas, rondas, scores,
        standings) + envío de invitaciones. Vienen en Fase 3c y 3d.
      </section>
    </div>
  );
}
