"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NavigationLoader } from "@/components/NavigationLoader";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { NotificationBell } from "@/components/NotificationBell";
import { ActiveMatchRedirect } from "@/components/match/ActiveMatchRedirect";
import { ActiveMatchChip } from "@/components/match/ActiveMatchChip";
import { FloatingActionStack } from "@/components/match/FloatingActionStack";
import { PodiumIcon } from "@/components/icons/PodiumIcon";
import { TrophyIcon } from "@/components/icons/TrophyIcon";
import { HamburgerDrawer } from "@/components/HamburgerDrawer";
import { CreateSheet } from "@/components/CreateSheet";
import { CreatePopover } from "@/components/CreatePopover";
import { Avatar } from "@/components/Avatar";
import type { AdminOrgSummary } from "@/lib/club-pro/auth";

type NavItem = { href: string; label: string; icon: React.ReactNode; beta?: boolean; badge?: number };

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
  user: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  plus: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  book: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  ),
  menu: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  ),
};

export function AppShell({
  user,
  profile,
  counts,
  adminOrgs = [],
  children,
}: {
  user: { id: string } | null;
  profile: { username?: string; display_name?: string | null; avatar_url?: string | null } | null;
  counts?: { unread: number } | null;
  adminOrgs?: AdminOrgSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

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

  // Rutas standalone fullscreen — el display público de torneo (/t/[slug])
  // se proyecta en TV y el ghost-claim flow (/claim/[token]) es público sin
  // chrome. Ambos definen su propio layout completo en /app/t/[slug]/layout.tsx
  // y /app/claim/[token]/page.tsx. AppShell se aparta — sin sidebar, sin
  // bottom-nav, sin max-width container.
  if (pathname.startsWith("/t/") || pathname.startsWith("/claim/")) {
    return (
      <>
        <NavigationLoader />
        {children}
      </>
    );
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const unread = counts?.unread ?? 0;
  // Tabs primarios del bottom-nav mobile (4). En el centro va el FAB Crear,
  // que es un &lt;button&gt;, no un tab. Torneos vive en el drawer.
  const primaryTabs: NavItem[] = [
    { href: "/dashboard",    label: "Inicio",   icon: ICON.home },
    { href: "/leaderboard",  label: "Ranking",  icon: ICON.podium },
    { href: "/groups",       label: "Grupos",   icon: ICON.users },
    { href: "/profile",      label: "Perfil",   icon: ICON.user },
  ];
  // Ítem adicional que solo aparece en el sidebar desktop (en mobile va al drawer).
  const desktopExtras: NavItem[] = [
    { href: "/tournaments",  label: "Torneos",  icon: ICON.trophy, beta: true },
  ];

  function renderMobileTab(it: NavItem, active: boolean, avatarProfile?: typeof profile | null) {
    const showAvatar = it.href === "/profile" && avatarProfile;
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={`group flex flex-col items-center justify-center gap-1 transition-all ${
          active ? "text-primary" : "text-text-mute"
        }`}
      >
        <span className={`relative transition-transform ${active ? "scale-110" : "opacity-70"}`}>
          {showAvatar ? (
            <span className={`inline-flex rounded-full ${active ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-bg" : ""}`}>
              <Avatar player={avatarProfile as never} size={28} />
            </span>
          ) : (
            it.icon
          )}
        </span>
        {!showAvatar && (
          <span className={`text-[10px] font-semibold tracking-wide ${active ? "opacity-100" : "opacity-60"}`}>
            {it.label}
          </span>
        )}
      </Link>
    );
  }

  function renderSidebarLink(it: NavItem, active: boolean, avatarProfile?: typeof profile | null) {
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
          active ? "bg-surface-2 text-text" : "text-text-dim hover:text-text hover:bg-surface-2"
        }`}
      >
        <span className={`relative ${active ? "opacity-100 text-primary" : "opacity-50"}`}>
          {avatarProfile ? (
            <Avatar player={avatarProfile as never} size={24} />
          ) : (
            it.icon
          )}
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
  }

  return (
    <div className="min-h-screen md:flex">
      <NavigationLoader />
      {user && <RealtimeNotifications userId={user.id} />}
      {user && <ActiveMatchRedirect userId={user.id} />}
      {user && (
        <FloatingActionStack>
          <ActiveMatchChip userId={user.id} />
          {/* TODO: <BugReportFAB/> aterriza acá cuando se mergee */}
        </FloatingActionStack>
      )}

      {/* SIDEBAR DESKTOP */}
      {user && (
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-bg-2/40">
          <div className="px-5 h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center group" aria-label="DomiRank — Inicio">
              <Image
                src="/branding/logo-horizontal-clean.svg"
                alt="DomiRank"
                width={158}
                height={40}
                priority
                className="h-10 w-auto transition-transform group-hover:scale-105"
              />
            </Link>
            <NotificationBell userId={user.id} initialUnreadCount={unread} />
          </div>
          <nav className="flex-1 px-3 space-y-0.5 py-3">
            {/* Inicio, Ranking */}
            {primaryTabs.slice(0, 2).map((it) => renderSidebarLink(it, isActive(it.href)))}

            {/* Crear (+) — anclado con popover */}
            <div className="relative">
              <button
                ref={createTriggerRef}
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-label="Crear"
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  createOpen ? "bg-surface-2 text-text" : "text-text-dim hover:text-text hover:bg-surface-2"
                }`}
              >
                <span className={`grid place-items-center w-6 h-6 rounded-md bg-emerald-500 text-white transition-transform ${createOpen ? "rotate-45" : ""}`}>
                  {ICON.plus}
                </span>
                <span className="text-[14px] font-semibold">Crear</span>
              </button>
              <CreatePopover open={createOpen} onClose={() => setCreateOpen(false)} anchorRef={createTriggerRef} />
            </div>

            {/* Grupos, Perfil */}
            {primaryTabs.slice(2).map((it) => renderSidebarLink(it, isActive(it.href), it.href === "/profile" ? profile : null))}

            {/* Torneos (secundario) */}
            {desktopExtras.map((it) => renderSidebarLink(it, isActive(it.href)))}

            {/* Menú (drawer) */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={drawerOpen}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors mt-1 text-text-dim hover:text-text hover:bg-surface-2"
            >
              <span className="opacity-50">{ICON.menu}</span>
              <span className="text-[14px]">Menú</span>
            </button>
          </nav>
        </aside>
      )}

      {/* MAIN COLUMN */}
      <div className="flex-1 min-w-0">
        {/* TOPBAR mobile */}
        <header className="md:hidden border-b border-border bg-bg/80 backdrop-blur-xl sticky top-0 z-30"
          style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <Link
              href={user ? "/dashboard" : "/"}
              className="flex items-center group"
              style={{ touchAction: "manipulation" }}
              aria-label="DomiRank — Inicio"
            >
              <Image
                src="/branding/logo-horizontal-clean.svg"
                alt="DomiRank"
                width={158}
                height={40}
                priority
                className="h-10 w-auto transition-transform group-hover:scale-105"
              />
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <NotificationBell userId={user.id} initialUnreadCount={unread} />
                <button
                  type="button"
                  aria-label="Abrir menú"
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center justify-center w-11 h-11 rounded-full text-text-dim active:opacity-70 hover:bg-surface-2 hover:text-text transition-colors"
                >
                  {ICON.menu}
                </button>
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

      {/* BOTTOM NAV mobile — 5 celdas: Inicio · Ranking · Crear(+) · Grupos · Perfil */}
      {user && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5 max-w-md mx-auto h-[62px]">
            {renderMobileTab(primaryTabs[0], isActive(primaryTabs[0].href))}
            {renderMobileTab(primaryTabs[1], isActive(primaryTabs[1].href))}

            {/* FAB Crear (centro) — NO navega, abre CreateSheet */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                aria-label="Crear"
                aria-haspopup="menu"
                aria-expanded={createOpen}
                className="relative flex items-center justify-center -mt-7 transition-all duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 focus-visible:outline-offset-4 rounded-lg"
                style={{
                  filter:
                    "drop-shadow(0 6px 8px rgba(0,0,0,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
                }}
              >
                <motion.span
                  animate={{ rotate: createOpen ? 45 : 0 }}
                  transition={{ type: "spring", damping: 18, stiffness: 320 }}
                  className="grid place-items-center w-14 h-10 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 border border-emerald-700/40 text-white"
                  aria-hidden="true"
                >
                  {ICON.plus}
                </motion.span>
              </button>
            </div>

            {renderMobileTab(primaryTabs[2], isActive(primaryTabs[2].href))}
            {renderMobileTab(primaryTabs[3], isActive(primaryTabs[3].href), profile)}
          </div>
        </nav>
      )}

      {/* Sheet Crear (mobile) — el sidebar desktop usa CreatePopover */}
      {user && (
        <div className="md:hidden">
          <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
      )}

      {/* Drawer hamburger (mobile + desktop) */}
      {user && (
        <HamburgerDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          profile={profile}
          adminOrgs={adminOrgs}
        />
      )}
    </div>
  );
}
