"use client";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export function ScopeToggle({ hasSession }: { hasSession: boolean }) {
  const sp = useSearchParams();
  const path = usePathname();
  const scope = sp?.get("scope") === "friends" ? "friends" : "global";

  const linkFor = (target: "global" | "friends") => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (target === "global") params.delete("scope");
    else params.set("scope", "friends");
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  return (
    <div className="inline-flex rounded-full bg-surface-2 border border-border p-1 text-sm">
      <Link href={linkFor("global")} className={`px-4 py-1.5 rounded-full transition-colors ${scope === "global" ? "bg-primary text-primary-ink font-semibold" : "text-text-mute"}`}>
        Global
      </Link>
      {hasSession ? (
        <Link href={linkFor("friends")} className={`px-4 py-1.5 rounded-full transition-colors ${scope === "friends" ? "bg-primary text-primary-ink font-semibold" : "text-text-mute"}`}>
          Amigos
        </Link>
      ) : (
        <Link href="/login?redirectTo=/leaderboard?scope=friends" className="px-4 py-1.5 rounded-full transition-colors text-text-mute">
          Amigos
        </Link>
      )}
    </div>
  );
}
