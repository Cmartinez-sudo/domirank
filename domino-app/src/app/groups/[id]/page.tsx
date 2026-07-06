import { redirect } from "next/navigation";

export default async function GroupRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/groups/${id}/leaderboard`);
}
