import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { StartTournamentButton, GenerateNextRoundButton } from './QuickActions';
import { SendInvitationsButton } from './SendInvitationsButton';

export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, description, prize_description, status, rounds_count, current_round_number, round_duration_minutes, target_points, scheduled_start_at, started_at, finished_at, display_slug',
    )
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const { count: pairCount } = await supabase
    .from('org_tournament_pairs')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
    .is('withdrawn_at', null);

  const { count: pendingMatchesCount } = await supabase
    .from('org_tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
    .in('status', ['pending', 'in_progress']);

  // Count invitations sent vs total players (active pairs × 2 players each).
  const { count: invitedCount } = await supabase
    .from('org_tournament_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id);
  const totalPlayers = (pairCount ?? 0) * 2;
  const pendingInvites = Math.max(0, totalPlayers - (invitedCount ?? 0));

  const canWrite = role === 'owner' || role === 'admin';
  const canStart =
    canWrite &&
    (tournament.status === 'draft' || tournament.status === 'ready') &&
    (pairCount ?? 0) >= 4;
  const canGenerateNext =
    canWrite &&
    tournament.status === 'in_progress' &&
    (pendingMatchesCount ?? 0) === 0 &&
    (tournament.current_round_number ?? 0) < tournament.rounds_count;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Estado">
          <dl className="space-y-2 text-sm">
            <Row label="Parejas activas" value={String(pairCount ?? 0)} />
            <Row
              label="Rondas"
              value={`${tournament.current_round_number ?? 0} / ${tournament.rounds_count}`}
            />
            <Row label="Duración por ronda" value={`${tournament.round_duration_minutes} min`} />
            <Row label="Meta de tantos" value={String(tournament.target_points)} />
            <Row
              label="Inicio programado"
              value={formatDateTime(tournament.scheduled_start_at)}
            />
            {tournament.started_at && (
              <Row label="Iniciado" value={formatDateTime(tournament.started_at)} />
            )}
            {tournament.finished_at && (
              <Row label="Finalizado" value={formatDateTime(tournament.finished_at)} />
            )}
          </dl>
        </Card>

        <Card title="Display público">
          <p className="text-sm text-slate-600">
            URL para proyectar en la pantalla del venue:
          </p>
          <code className="mt-2 block break-all rounded bg-slate-100 px-2 py-1 text-xs">
            /t/{tournament.display_slug}
          </code>
          <p className="mt-3 text-xs text-slate-500">
            Visible públicamente cuando el torneo esté en curso o finalizado.
          </p>
        </Card>
      </section>

      {tournament.description && (
        <Card title="Descripción">
          <p className="whitespace-pre-line text-sm text-slate-700">
            {tournament.description}
          </p>
        </Card>
      )}

      {tournament.prize_description && (
        <Card title="Premio">
          <p className="text-sm text-slate-700">{tournament.prize_description}</p>
        </Card>
      )}

      {canWrite && (
        <Card title="Acciones">
          <div className="flex flex-wrap gap-3">
            {pendingInvites > 0 &&
              (tournament.status === 'draft' || tournament.status === 'in_progress') && (
                <SendInvitationsButton
                  orgSlug={orgSlug}
                  tournamentId={tournament.id}
                  pendingCount={pendingInvites}
                />
              )}
            {canStart && (
              <StartTournamentButton orgSlug={orgSlug} tournamentId={tournament.id} />
            )}
            {canGenerateNext && (
              <GenerateNextRoundButton
                orgSlug={orgSlug}
                tournamentId={tournament.id}
              />
            )}
            {tournament.status === 'in_progress' && (pendingMatchesCount ?? 0) > 0 && (
              <Link
                href={`/admin/org/${orgSlug}/tournaments/${tournament.id}/rounds`}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cargar scores ({pendingMatchesCount} pendientes)
              </Link>
            )}
            {tournament.status === 'draft' && (pairCount ?? 0) < 4 && (
              <p className="text-sm text-amber-700">
                Mínimo 4 parejas para iniciar. Actualmente: {pairCount ?? 0}.
              </p>
            )}
            {totalPlayers > 0 && pendingInvites === 0 && (
              <p className="text-sm text-emerald-700">
                ✓ Todas las invitaciones enviadas ({invitedCount}/{totalPlayers}).
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
