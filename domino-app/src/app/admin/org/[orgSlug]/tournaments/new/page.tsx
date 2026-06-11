import Link from 'next/link';
import { requireOrgAdmin } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { CreateTournamentWizard } from './CreateTournamentWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Nuevo torneo · ${orgSlug} · Admin · DomiRank` };
}

export default async function NewTournamentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Only owner/admin can create. Staff gets 404.
  const { org } = await requireOrgAdmin(orgSlug);

  // Enforce the "one active per org" invariant client-side too — even though
  // RLS + UNIQUE INDEX would reject the insert, surface the constraint
  // before the user fills out the form.
  const supabase = await supabaseServer();
  const { data: active } = await supabase
    .from('org_tournaments')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (active) {
    // Don't 404 — show an actionable error.
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">No se puede crear torneo</h1>
        <p className="text-sm text-slate-600">
          Ya hay un torneo en curso (<strong>{active.name}</strong>). Esperá a
          que termine o cancelalo antes de crear uno nuevo.
        </p>
        <Link
          href={`/admin/org/${org.slug}/tournaments/${active.id}`}
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Ir al torneo activo →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/admin/org/${org.slug}`}
          className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
        >
          ← Volver al dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Crear nuevo torneo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configurá el formato, agregá las parejas y mandá las invitaciones.
        </p>
      </header>
      <CreateTournamentWizard orgSlug={org.slug} orgName={org.name} />
    </div>
  );
}
