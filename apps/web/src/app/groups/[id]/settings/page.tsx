import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/groups-queries";
import { SettingsPanel } from "./SettingsPanel";

export const dynamic = "force-dynamic";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const group = await getGroupDetails(id);
  if (!group) notFound();

  // Solo el creator/admin entra acá (decisión #13).
  if (group.created_by_user_id !== user.id) {
    redirect(`/groups/${id}/leaderboard`);
  }

  const otherActiveMembers = group.members
    .filter((m) => m.user_id !== user.id)
    .map((m) => ({
      user_id: m.user_id,
      username: m.username,
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      role: m.role,
    }));

  return (
    <SettingsPanel
      groupId={id}
      initialName={group.name}
      initialDescription={group.description ?? ""}
      initialAllowFriendlies={group.allow_friendlies}
      isActive={group.is_active}
      otherMembers={otherActiveMembers}
    />
  );
}
