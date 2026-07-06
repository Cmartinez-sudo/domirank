import Link from "next/link";
import type { GroupSummary } from "@/lib/groups-queries";

const ROLE_LABELS: Record<GroupSummary["my_role"], string> = {
  admin: "Admin",
  co_admin: "Co-admin",
  member: "Miembro",
};

const ROLE_STYLES: Record<GroupSummary["my_role"], string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  co_admin: "bg-info/15 text-info border-info/30",
  member: "bg-surface-3 text-text-mute border-border",
};

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.id}/leaderboard`}
      className="card hover:border-border-strong transition-colors block"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{group.name}</h3>
          {group.description && (
            <p className="text-text-mute text-sm mt-1 line-clamp-2">{group.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
            <span>
              {group.active_members_count}{" "}
              {group.active_members_count === 1 ? "miembro" : "miembros"}
            </span>
            {!group.allow_friendlies && (
              <span className="text-text-mute">· Sin amistosas</span>
            )}
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${ROLE_STYLES[group.my_role]}`}
        >
          {ROLE_LABELS[group.my_role]}
        </span>
      </div>
    </Link>
  );
}
