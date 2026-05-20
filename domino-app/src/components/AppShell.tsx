"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { NavigationLoader } from "@/components/NavigationLoader";

type NavItem = { href: string; label: string; icon: React.ReactNode; isCenter?: boolean };

const ICON = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  trophy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  ),
  plus: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  pollas: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M5 9V7l1.5-3h11L19 7v2"/><path d="M5 9h14v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/></svg>
  ),
  book: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  ),
};

export function AppShell({
  user,
  profile,
  children,
}: {
  user: { id: string } | null;
  profile: { username?: string; display_name?: string | null; avatar_url?: string | null } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/matches/new") return pathname.startsWith("/matches");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const items: NavItem[] = [
    { href: "/dashboard",    label: "Inicio",   icon: ICON.home },
    { href: "/leaderboard",  label: "Ranking",  icon: ICON.trophy },
    { href: "/matches/new",  label: "Jugar",    icon: ICON.plus, isCenter: true },
    { href: "/tournaments",  label: "Torneos",  icon: ICON.pollas },
    { href: "/friends",      label: "Amigos",   icon: ICON.users },
  ];

  return (
    <div className="min-h-screen md:flex">
      <NavigationLoader />
      {/* SIDEBAR DESKTOP */}
      {user && (
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-bg-2/40">
          <div className="px-4 h-14 flex items-center">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span
                className="inline-grid place-items-center w-7 h-7 rounded text-black text-xs font-extrabold"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              >
                DR
              </span>
              <span>DomiRank</span>
            </Link>
          </div>
          <nav className="flex-1 px-3 space-y-0.5 py-3">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    active
                      ? "bg-surface-2 text-text"
                      : "text-text-dim hover:text-text hover:bg-surface-2"
                  }`}
                >
                  <span className={active ? "opacity-100" : "opacity-60"}>{it.icon}</span>
                  <span className={`text-sm ${active ? "font-medium" : ""}`}>{it.label}</span>
                </Link>
              );
            })}
            <Link
              href="/como-funciona"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors mt-2 ${
                pathname === "/como-funciona"
                  ? "bg-surface-2 text-text"
                  : "text-text-dim hover:text-text hover:bg-surface-2"
              }`}
            >
              <span className="opacity-60">{ICON.book}</span>
              <span className="text-sm">Cómo funciona</span>
            </Link>
          </nav>
          {profile && (
            <Link href="/settings" className="flex items-center gap-3 px-3 py-3 m-3 rounded-md hover:bg-surface-2 transition-colors border border-border">
              <Avatar player={profile as any} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{profile.display_name || profile.username}</div>
                <div className="text-text-mute text-xs truncate">@{profile.username}</div>
              </div>
            </Link>
          )}
        </aside>
      )}

      {/* MAIN COLUMN */}
      <div className="flex-1 min-w-0">
        {/* TOPBAR mobile */}
        <header className="md:hidden border-b border-border bg-bg-2/85 backdrop-blur sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold tracking-tight">
              <span
                className="inline-grid place-items-center w-7 h-7 rounded text-black text-xs font-extrabold"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
              >
                DR
              </span>
              <span>DomiRank</span>
            </Link>
            {user ? (
              <Link href="/settings" className="flex items-center">
                {profile && <Avatar player={profile as any} size={32} />}
              </Link>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-1.5">Entrar</Link>
            )}
          </div>
        </header>

        <main className={`max-w-4xl mx-auto px-4 py-6 ${user ? "pb-24 md:pb-8" : "pb-8"}`}>
          {children}
        </main>

        {!user && (
          <footer className="max-w-4xl mx-auto px-4 py-6 text-center text-text-mute text-xs space-x-4">
            <Link href="/terms" className="hover:text-text">Términos</Link>
            <Link href="/privacy" className="hover:text-text">Privacidad</Link>
            <Link href="/como-funciona" className="hover:text-text">Cómo funciona</Link>
          </footer>
        )}
      </div>

      {/* BOTTOM NAV mobile */}
      {user && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-2/95 backdrop-blur border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5 max-w-md mx-auto">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                    it.isCenter ? "" : active ? "text-primary" : "text-text-mute hover:text-text"
                  }`}
                >
                  {it.isCenter ? (
                    <span
                      className="grid place-items-center w-12 h-12 rounded-full text-black -mt-6 shadow-lg transition-transform active:scale-95"
                      style={{ background: active ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,#10b981,#059669)" }}
                    >
                      {it.icon}
                    </span>
                  ) : (
                    <span className={active ? "opacity-100" : "opacity-60"}>{it.icon}</span>
                  )}
                  <span className={`text-[10px] font-medium ${it.isCenter ? "text-text-mute" : ""}`}>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
