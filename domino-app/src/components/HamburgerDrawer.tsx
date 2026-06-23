"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { getDisplayRating } from "@/lib/rating";

/**
 * Drawer lateral con items secundarios (Fase C+D #4 — nav global).
 *
 * Contenido:
 *  - Card del perfil (avatar, display_name, @username, DomiRank Global).
 *  - Amigos.
 *  - Cómo funciona.
 *  - Settings.
 *  - Cerrar sesión.
 *
 * UX: slide-in desde la derecha (mobile + desktop). Backdrop oscuro.
 * Click backdrop o ESC cierra. Cierra automáticamente al navegar.
 */

type DrawerProfile = {
  id?: string;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_rated?: boolean | null;
  global_display?: number | null;
  global_elo?: number | null;
};

export function HamburgerDrawer({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: DrawerProfile | null;
}) {
  const pathname = usePathname();

  // Cerrar al cambiar de ruta.
  useEffect(() => {
    if (open) onClose();
    // Solo reaccionamos a pathname; onClose es estable en el caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ESC cierra.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Body scroll lock cuando está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const display = profile ? getDisplayRating(profile) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slide-in desde derecha */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="fixed top-0 right-0 bottom-0 z-[70] w-[min(360px,90vw)] bg-bg-2 border-l border-border shadow-2xl flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header del drawer */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <span className="font-semibold text-sm">Menú</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Card del perfil */}
        {profile && (
          <Link
            href="/settings"
            className="m-3 p-4 rounded-2xl bg-surface-2 border border-border hover:border-border-strong transition-colors flex items-center gap-3"
          >
            <Avatar player={profile as never} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {profile.display_name || profile.username || "Usuario"}
              </div>
              {profile.username && (
                <div className="text-text-mute text-xs truncate">@{profile.username}</div>
              )}
              {display != null && (
                <div className="mt-1 inline-flex items-center gap-1.5 text-xs">
                  <span className="text-text-mute">DomiRank:</span>
                  <span className="font-mono font-bold text-primary">{Number(display).toFixed(1)}</span>
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <DrawerLink href="/friends" icon={ICON_FRIENDS} label="Amigos" />
          <DrawerLink href="/como-funciona" icon={ICON_BOOK} label="Cómo funciona" />
          <DrawerLink href="/settings" icon={ICON_SETTINGS} label="Ajustes" />
        </nav>

        {/* Cerrar sesión — al fondo */}
        <div className="border-t border-border p-3">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-danger hover:bg-danger/10 transition-colors text-sm font-medium"
            >
              <span aria-hidden="true">{ICON_LOGOUT}</span>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function DrawerLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-3 rounded-xl text-text-dim hover:text-text hover:bg-surface-2 transition-colors text-sm font-medium"
    >
      <span aria-hidden="true" className="opacity-70">{icon}</span>
      {label}
    </Link>
  );
}

// ─── Icons (inline para evitar dependency) ──────────────────────────────────

const ICON_FRIENDS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ICON_BOOK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const ICON_SETTINGS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ICON_LOGOUT = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
