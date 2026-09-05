import { redirect } from 'next/navigation';

export default async function TournamentRoot({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  redirect(`/admin/org/${orgSlug}/tournaments/${id}/overview`);
}
