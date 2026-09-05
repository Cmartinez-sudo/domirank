"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({
  groupId,
  isAdmin,
  isAdminOrCo,
}: {
  groupId: string;
  isAdmin: boolean;
  isAdminOrCo: boolean;
}) {
  void isAdminOrCo;
  const pathname = usePathname();
  const base = `/groups/${groupId}`;

  const tabs: Array<{ href: string; label: string }> = [
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/members`, label: "Miembros" },
    { href: `${base}/history`, label: "Historial" },
  ];
  if (isAdmin) tabs.push({ href: `${base}/settings`, label: "Ajustes" });

  return (
    <nav
      className="flex gap-1 border-b border-border overflow-x-auto"
      role="tablist"
      aria-label="Secciones del grupo"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-text-mute hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
