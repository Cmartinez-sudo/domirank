import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/groups-queries";
import { GroupTabs } from "./GroupTabs";

export const dynamic = "force-dynamic";

export default async function GroupDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  await requireUser();
  const { id } = await params;
  const group = await getGroupDetails(id);
  if (!group) notFound();

  const isAdmin = group.my_role === "admin";
  const isAdminOrCo = group.my_role === "admin" || group.my_role === "co_admin";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/groups"
          className="text-text-mute text-sm hover:text-text inline-flex items-center gap-1"
        >
          ← Grupos
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">{group.name}</h1>
            {group.description && (
              <p className="text-text-mute text-sm mt-1">{group.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
              <span>{group.members.length} miembros</span>
              {!group.allow_friendlies && <span>· Sin amistosas</span>}
              {!group.is_active && (
                <span className="text-danger font-semibold">· Desactivado</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <GroupTabs groupId={id} isAdmin={isAdmin} isAdminOrCo={isAdminOrCo} />

      {/* Tab content */}
      <div>{children}</div>
    </div>
  );
}
