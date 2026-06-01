"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { NavigationLoader } from "@/components/NavigationLoader";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { NotificationBell } from "@/components/NotificationBell";
import { PodiumIcon } from "@/components/icons/PodiumIcon";
import { TrophyIcon } from "@/components/icons/TrophyIcon";

type NavItem = { href: string; label: string; icon: React.ReactNode; isCenter?: boolean; beta?: boolean; badge?: number };

const ICON = {
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  podium: <PodiumIcon />,
  trophy: <TrophyIcon />,
  domino: (
    <svg
      className="relative"
      width="24"
      height="36"
      viewBox="0 0 24 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: "rotate(-12deg)" }}
    >
      {/* Outline */}
      <rect x="2" y="2" width="20" height="32" rx="3" ry="3"
            fill="currentColor" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
      {/* Línea divisora */}
      <line x1="4" y1="18" x2="20" y2="18" stroke="rgba(255,255,255,0.95)" strokeWidth="0.8" />
      {/* Mitad superior: 5 pips (X pattern: 4 corners + center) */}
      <circle cx="7"  cy="6"  r="1.5" fill="#000" />
      <circle cx="17" cy="6"  r="1.5" fill="#000" />
      <circle cx="12" cy="11" r="1.5" fill="#000" />
      <circle cx="7"  cy="15" r="1.5" fill="#000" />
      <circle cx="17" cy="15" r="1.5" fill="#000" />
      {/* Mitad inferior: 3 pips (diagonal: top-right, center, bottom-left) */}
      <circle cx="17" cy="22" r="1.5" fill="#000" />
      <circle cx="12" cy="26" r="1.5" fill="#000" />
      <circle cx="7"  cy="30" r="1.5" fill="#000" />
    </svg>
  ),
  users: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  book: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  ),
};

export function AppShell({
  user,
  profile,
  counts,
  children,
}: {
  user: { id: string } | null;
  profile: { username?: string; display_name?: string | null; avatar_url?: string | null } | null;
  counts?: { unread: number } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // El landing en "/" renderiza su propio layout (Topnav + Footer). AppShell
  // se hace a un lado para no duplicar chrome.
  if (!user && pathname === "/") {
    return (
      <>
        <NavigationLoader />
        {children}
      </>
    );
  }

  const isActive = (href: string) => {
    if (href === "/matches/new") return pathname.startsWith("/matches");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const unread = counts?.unread ?? 0;
  const items: NavItem[] = [
    { href: "/dashboard",    label: "Inicio",   icon: ICON.home },
    { href: "/leaderboard",  label: "Ranking",  icon: ICON.podium },
    { href: "/matches/new",  label: "Jugar",    icon: ICON.domino, isCenter: true },
    { href: "/tournaments",  label: "Torneos",  icon: ICON.trophy, beta: true },
    { href: "/friends",      label: "Amigos",   icon: ICON.users },
  ];

  return (
    <div className="min-h-screen md:flex">
      <NavigationLoader />
      {user && <RealtimeNotifications userId={user.id} />}

      {/* SIDEBAR DESKTOP */}
      {user && (
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-bg-2/40">
          <div className="px-5 h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center" aria-label="DomiRank — Inicio">
              <Image
                src="/branding/logo-vertical.svg"
                alt="DomiRank"
                width={120}
                height={56}
                priority
                className="h-12 w-auto"
              />
            </Link>
            <NotificationBell userId={user.id} initialUnreadCount={unread} />
          </div>
          <nav className="flex-1 px-3 space-y-0.5 py-3">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                    active
                      ? "bg-surface-2 text-text"
                      : "text-text-dim hover:text-text hover:bg-surface-2"
                  }`}
                >
                  <span className={`relative ${active ? "opacity-100 text-primary" : "opacity-50"}`}>
                    {it.icon}
                    {it.badge != null && it.badge > 0 && (
                      <span className="absolute -top-1 -right-1.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-none border border-bg-2">
                        {it.badge > 9 ? "9+" : it.badge}
                      </span>
                    )}
                  </span>
                  <span className={`text-[14px] ${active ? "font-semibold" : ""}`}>{it.label}</span>
                  {it.beta && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24" }}>beta</span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/como-funciona"
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors mt-1 ${
                pathname === "/como-funciona"
                  ? "bg-surface-2 text-text"
                  : "text-text-dim hover:text-text hover:bg-surface-2"
              }`}
            >
              <span className="opacity-50">{ICON.book}</span>
              <span className="text-[14px]">Cómo funciona</span>
            </Link>
          </nav>
          {profile && (
            <Link href="/settings" className="flex items-center gap-3 px-3 py-3.5 mx-3 mb-4 rounded-2xl hover:bg-surface-2 transition-colors border border-border">
              <Avatar player={profile as any} size={38} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate">{profile.display_name || profile.username}</div>
                <div className="text-text-mute text-xs truncate">@{profile.username}</div>
              </div>
            </Link>
          )}
        </aside>
      )}

      {/* MAIN COLUMN */}
      <div className="flex-1 min-w-0">
        {/* TOPBAR mobile */}
        <header className="md:hidden border-b border-border bg-bg/80 backdrop-blur-xl sticky top-0 z-30"
          style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="px-4 h-[56px] flex items-center justify-between gap-3">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center" aria-label="DomiRank — Inicio">
              <Image
                src="/branding/logo-horizontal-tagline.svg"
                alt="DomiRank · Tu app de dominó"
                width={140}
                height={32}
                priority
                className="h-8 w-auto"
              />
            </Link>
            {user ? (
              <div className="flex items-center gap-1">
                <NotificationBell userId={user.id} initialUnreadCount={unread} />
                <Link
                  href="/settings"
                  aria-label="Ajustes de tu cuenta"
                  className="flex items-center justify-center w-11 h-11 rounded-full active:opacity-70 hover:bg-surface-2 transition-opacity"
                >
                  {profile && <Avatar player={profile as any} size={36} />}
                </Link>
              </div>
            ) : (
              <Link href="/login" className="btn-primary !min-h-0 !py-2 !px-4 text-sm">Entrar</Link>
            )}
          </div>
        </header>

        <main className={`max-w-4xl mx-auto px-4 py-5 ${user ? "pb-28 md:pb-8" : "pb-8"}`}>
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
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5 max-w-md mx-auto h-[62px]">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={it.isCenter ? "Nueva partida" : undefined}
                  className={`group flex flex-col items-center justify-center gap-1 transition-all ${
                    it.isCenter ? "" : active ? "text-primary" : "text-text-mute"
                  }`}
                >
                  {it.isCenter ? (
                    <span
                      className="relative flex items-center justify-center -mt-7 transition-all duration-200 ease-out hover:scale-105 active:scale-95 active:[filter:drop-shadow(0_3px_4px_rgba(0,0,0,0.3))] group-focus-visible:[outline:2px_solid_#34d399] group-focus-visible:outline-offset-4 group-focus-visible:rounded-md"
                      style={{
                        filter:
                          "drop-shadow(0 6px 8px rgba(0,0,0,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
                      }}
                    >
                      <svg
                        width="52"
                        height="34"
                        viewBox="0 0 36 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ transform: "rotate(-15deg)" }}
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id="domino-tile-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                        </defs>
                        {/* Cuerpo de la ficha — verde DomiRank (emerald-500 → emerald-600) */}
                        <rect
                          x="0.5"
                          y="0.5"
                          width="35"
                          height="23"
                          rx="3"
                          fill="url(#domino-tile-gradient)"
                          stroke="rgba(0,0,0,0.25)"
                          strokeWidth="0.5"
                        />
                        {/* Línea divisora central */}
                        <line
                          x1="18"
                          y1="3"
                          x2="18"
                          y2="21"
                          stroke="#1a1a1a"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                        />
                        {/* Izquierda: 5 pips (X) */}
                        <circle cx="5"  cy="6"  r="1.3" fill="#1a1a1a" />
                        <circle cx="13" cy="6"  r="1.3" fill="#1a1a1a" />
                        <circle cx="9"  cy="12" r="1.3" fill="#1a1a1a" />
                        <circle cx="5"  cy="18" r="1.3" fill="#1a1a1a" />
                        <circle cx="13" cy="18" r="1.3" fill="#1a1a1a" />
                        {/* Derecha: 3 pips (diagonal) */}
                        <circle cx="23" cy="6"  r="1.3" fill="#1a1a1a" />
                        <circle cx="27" cy="12" r="1.3" fill="#1a1a1a" />
                        <circle cx="31" cy="18" r="1.3" fill="#1a1a1a" />
                      </svg>
                    </span>
                  ) : (
                    <span className={`relative transition-transform ${active ? "scale-110" : "opacity-50"}`}>
                      {it.icon}
                      {it.beta && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 border border-bg" />
                      )}
                      {it.badge != null && it.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-none border border-bg">
                          {it.badge > 9 ? "9+" : it.badge}
                        </span>
                      )}
                    </span>
                  )}
                  {!it.isCenter && (
                    <span className={`text-[10px] font-semibold tracking-wide ${active ? "opacity-100" : "opacity-60"}`}>
                      {it.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
