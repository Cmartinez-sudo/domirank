import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/service";
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
  // Reads con service_role: getGroupDetails ya verificó que el user es miembro
  // activo, así que exponer profile_ratings de los co-members es seguro.
  const service = supabaseService();
  const userIds = group.members.map((m) => m.user_id);
  const ratingsMap = new Map<string, { global_display: number | null; is_rated: boolean }>();
  if (userIds.length > 0) {
    const { data: ratings } = await service
      .from("profile_ratings")
      .select("id, global_display, is_rated")
      .in("id", userIds);
    for (const r of (ratings ?? []) as Array<{ id: string; global_display: number | null; is_rated: boolean }>) {
      ratingsMap.set(r.id, { global_display: r.global_display, is_rated: r.is_rated });
    }
  }

  // Invitaciones pendientes del grupo (visible para admin/co_admin).
  // NOTA: el embedded profiles:profiles!fk_name(...) no funciona porque el
  // FK invited_user_id apunta a auth.users. Hacemos batch lookup separado.
  type PendingInvitationRow = {
    invitation_id: string;
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  let pending: PendingInvitationRow[] = [];
  if (isAdminOrCo) {
    const { data: invRaw } = await service
      .from("group_invitations")
      .select("id, invited_user_id, created_at")
      .eq("group_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const invRows = (invRaw as Array<{ id: string; invited_user_id: string; created_at: string }> | null) ?? [];
    if (invRows.length > 0) {
      const invUserIds = Array.from(new Set(invRows.map((r) => r.invited_user_id)));
      const { data: invProfiles } = await service
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", invUserIds);
      const invProfileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
      for (const p of (invProfiles ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>) {
        invProfileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
      pending = invRows.map((r) => {
        const p = invProfileMap.get(r.invited_user_id);
        return {
          invitation_id: r.id,
          user_id: r.invited_user_id,
          username: p?.username ?? "?",
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          created_at: r.created_at,
        };
      });
    }
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
      pending={pending}
      currentUserId={user.id}
      isAdminOrCo={isAdminOrCo}
      isCreator={isCreator}
    />
  );
}
