import { requireOrgAdmin } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { resolveDisplayConfig } from '@/lib/club-pro/display-config';
import { DisplayEditorClient } from './DisplayEditorClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Display · ${orgSlug} · Admin · DomiRank` };
}

export default async function DisplayEditorPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await requireOrgAdmin(orgSlug);
  const supabase = await supabaseServer();

  const { data: full } = await supabase
    .from('organizations')
    .select('id, display_config')
    .eq('id', org.id)
    .maybeSingle();

  // Even if the row lookup misfired, the resolver falls back to the
  // default — the editor never crashes for lack of a saved config.
  const initialConfig = resolveDisplayConfig(full?.display_config);
  const hasCustomConfig = full?.display_config != null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Editor de display
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Personalizá cómo se ve la pantalla que se proyecta en la TV del venue
          para todos los torneos de <strong>{org.name}</strong>. Los cambios
          aplican a nivel organización.
        </p>
      </header>

      {/* Desktop-only gate — mobile shows a friendly message instead of a
          broken editor. Spec: "El editor de la pantalla SOLO está disponible
          en desktop. Bloquealo por breakpoint, no lo escondas a medias." */}
      <div className="hidden lg:block">
        <DisplayEditorClient
          orgSlug={org.slug}
          initialConfig={initialConfig}
          initialHasCustomConfig={hasCustomConfig}
        />
      </div>
      <div className="lg:hidden rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="mx-auto max-w-md space-y-3">
          <div className="text-4xl">🖥️</div>
          <h2 className="text-lg font-semibold">Editor solo disponible en desktop</h2>
          <p className="text-sm text-slate-600">
            Diseñar el layout de la pantalla del venue requiere una
            resolución de al menos 1024 px de ancho. Abrí este editor
            en una laptop o desktop para continuar.
          </p>
        </div>
      </div>
    </div>
  );
}
