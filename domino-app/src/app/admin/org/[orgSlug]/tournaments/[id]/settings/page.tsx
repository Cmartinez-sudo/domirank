import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { AssetUploader } from './AssetUploader';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
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
      'id, name, description, display_slug, status, rounds_count, round_duration_minutes, target_points, scheduled_start_at, prize_description, logo_url, sponsor_1_logo_url, sponsor_2_logo_url',
    )
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const canWrite = role === 'owner' || role === 'admin';
  const displayUrl = `/t/${tournament.display_slug}`;

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Información
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Nombre" value={tournament.name} />
          <Row label="Display slug" value={tournament.display_slug} mono />
          <Row label="Rondas" value={String(tournament.rounds_count)} />
          <Row
            label="Duración por ronda"
            value={`${tournament.round_duration_minutes} min`}
          />
          <Row label="Meta de tantos" value={String(tournament.target_points)} />
          <Row label="Estado" value={tournament.status} />
          {tournament.description && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Descripción</dt>
              <dd className="mt-1 whitespace-pre-line text-slate-900">
                {tournament.description}
              </dd>
            </div>
          )}
          {tournament.prize_description && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Premio</dt>
              <dd className="mt-1 text-slate-900">{tournament.prize_description}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Display público
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Esta URL es pública cuando el torneo está en curso o finalizado.
          Proyectala en la pantalla del venue.
        </p>
        <Link
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block break-all rounded bg-slate-100 px-3 py-2 font-mono text-xs hover:bg-slate-200"
        >
          {displayUrl}
        </Link>
      </section>

      {canWrite && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Branding
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Imágenes que aparecen en el display público del torneo. PNG, JPG,
            WebP o SVG, máximo 500 KB.
          </p>
          <div className="mt-4 space-y-4">
            <AssetUploader
              orgSlug={org.slug}
              tournamentId={tournament.id}
              slot="logo"
              currentUrl={tournament.logo_url}
            />
            <AssetUploader
              orgSlug={org.slug}
              tournamentId={tournament.id}
              slot="sponsor_1"
              currentUrl={tournament.sponsor_1_logo_url}
            />
            <AssetUploader
              orgSlug={org.slug}
              tournamentId={tournament.id}
              slot="sponsor_2"
              currentUrl={tournament.sponsor_2_logo_url}
            />
          </div>
        </section>
      )}

      {canWrite && (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
            Edición avanzada
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            La edición de nombre, descripción, parámetros y cancelación viene
            en una sub-fase futura. Por ahora estos valores son los que
            ingresaste en el wizard.
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`mt-1 ${mono ? 'font-mono text-xs' : ''} text-slate-900`}>
        {value}
      </dd>
    </div>
  );
}
