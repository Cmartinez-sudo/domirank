import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getGroupDetails } from "@/lib/groups-queries";
import { MembersPanel } from "./MembersPanel";

export const dynamic = "force-dynamic";

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const group = await getGroupDetails(id);
  if (!group) notFound();

  const isAdminOrCo = group.my_role === "admin" || group.my_role === "co_admin";
  const isCreator = group.created_by_user_id === user.id;

  // DomiRank Global de cada miembro (vía profile_ratings).
  const userIds = group.members.map((m) => m.user_id);
  const ratingsMap = new Map<string, { global_display: number | null; is_rated: boolean }>();
  if (userIds.length > 0) {
    const supabase = await supabaseServer();
    const { data: ratings } = await supabase
      .from("profile_ratings")
      .select("id, global_display, is_rated")
      .in("id", userIds);
    for (const r of (ratings ?? []) as Array<{ id: string; global_display: number | null; is_rated: boolean }>) {
      ratingsMap.set(r.id, { global_display: r.global_display, is_rated: r.is_rated });
    }
  }

  // Invitaciones pendientes del grupo (visible para admin/co_admin).
  type PendingInvitationRow = {
    id: string;
    invited_user_id: string;
    created_at: string;
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  };
  let pending: PendingInvitationRow[] = [];
  if (isAdminOrCo) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("group_invitations")
      .select(`
        id,
        invited_user_id,
        created_at,
        profiles:profiles!group_invitations_invited_user_id_fkey(username, display_name, avatar_url)
      `)
      .eq("group_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pending = (data as unknown as PendingInvitationRow[] | null) ?? [];
  }

  const members = group.members.map((m) => ({
    ...m,
    rating_display: ratingsMap.get(m.user_id)?.global_display ?? null,
    is_rated: ratingsMap.get(m.user_id)?.is_rated ?? false,
  }));

  return (
    <MembersPanel
      groupId={id}
      members={members}
      pending={pending.map((p) => ({
        invitation_id: p.id,
        user_id: p.invited_user_id,
        username: p.profiles?.username ?? "?",
        display_name: p.profiles?.display_name ?? null,
        avatar_url: p.profiles?.avatar_url ?? null,
        created_at: p.created_at,
      }))}
      currentUserId={user.id}
      isAdminOrCo={isAdminOrCo}
      isCreator={isCreator}
    />
  );
}
