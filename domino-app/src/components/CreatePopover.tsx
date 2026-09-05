"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Action = {
  href: string;
  label: string;
  icon: React.ReactNode;
  featured?: boolean;
};

const ACTIONS: Action[] = [
  { href: "/matches/new",    label: "Nueva partida", icon: <PlayIcon />,   featured: true },
  { href: "/tournaments/new", label: "Crear torneo", icon: <TrophyIcon /> },
  { href: "/groups/new",     label: "Crear grupo",   icon: <UsersIcon /> },
];

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

export function CreatePopover({ open, onClose, anchorRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key="create-popover"
          role="menu"
          aria-label="Crear"
          initial={{ opacity: 0, x: -8, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="absolute left-full top-0 ml-2 w-64 rounded-2xl bg-bg-2 border border-border shadow-2xl p-2 z-[70]"
        >
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              onClick={onClose}
              className={
                a.featured
                  ? "flex items-center gap-3 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/25 to-primary/10 px-3 py-2.5 hover:from-primary/35 hover:to-primary/20 transition-colors"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 transition-colors mt-1"
              }
            >
              <span
                aria-hidden="true"
                className={
                  a.featured
                    ? "grid place-items-center w-9 h-9 rounded-lg bg-primary text-primary-ink shrink-0"
                    : "grid place-items-center w-9 h-9 rounded-lg bg-surface text-text-dim shrink-0"
                }
              >
                {a.icon}
              </span>
              <span className={a.featured ? "font-semibold text-text" : "font-semibold text-text"}>
                {a.label}
              </span>
            </Link>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
