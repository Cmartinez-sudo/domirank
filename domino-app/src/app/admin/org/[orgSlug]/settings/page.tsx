import { notFound } from 'next/navigation';
import { requireOrgAdmin } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { OrgAssetUploader } from './OrgAssetUploader';
import { OrgEditForm } from './OrgEditForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Configuración · ${orgSlug} · Admin · DomiRank` };
}

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await requireOrgAdmin(orgSlug);
  const supabase = await supabaseServer();

  const { data: full } = await supabase
    .from('organizations')
    .select(
      'id, name, slug, description, contact_email, website_url, brand_primary_color, logo_url',
    )
    .eq('id', org.id)
    .maybeSingle();

  if (!full) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Configuración de la organización</h1>
        <p className="mt-1 text-sm text-slate-600">
          Edita la información de tu organización y sube el logo que aparece
          en los torneos.
        </p>
      </header>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Branding
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          El logo aparece en el header del display público de cada torneo y
          en los emails de invitación.
        </p>
        <div className="mt-4">
          <OrgAssetUploader
            orgSlug={org.slug}
            slot="logo"
            currentUrl={full.logo_url}
          />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Información
        </h2>
        <div className="mt-4">
          <OrgEditForm
            orgSlug={org.slug}
            initial={{
              name: full.name,
              description: full.description,
              contactEmail: full.contact_email,
              websiteUrl: full.website_url,
              brandPrimaryColor: full.brand_primary_color,
            }}
          />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Detalles fijos
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <dt className="text-slate-500">Slug (URL)</dt>
          <dd className="font-mono text-xs">{full.slug}</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          El slug no se puede modificar — cambiarlo rompería las URLs de
          torneos pasados.
        </p>
      </section>
    </div>
  );
}
