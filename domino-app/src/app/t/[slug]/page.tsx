import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { DisplayClient } from './DisplayClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('tournament_public_display')
    .select('name, organization_name')
    .eq('display_slug', slug)
    .maybeSingle();
  if (!data) return { title: 'Torneo · DomiRank' };
  return {
    title: `${data.name} · ${data.organization_name} · DomiRank`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicDisplayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('tournament_public_display')
    .select('*')
    .eq('display_slug', slug)
    .maybeSingle();

  if (!tournament) notFound();

  return <DisplayClient slug={slug} initialTournament={tournament} />;
}
