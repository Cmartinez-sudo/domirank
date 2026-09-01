"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/ui/BottomSheet";

type Props = {
  open: boolean;
  onClose: () => void;
};

// TODO: activar cuando exista el flujo self-posted (match ×0.5, attest 0-1
// confirma / 2 anula). Cuando se agregue, sumar un ítem "Registrar
// resultado" al array de acciones — probablemente el 4to, secundario, sin
// destacado verde.

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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

export function CreateSheet({ open, onClose }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Crear">
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        role="menu"
        className="space-y-2"
      >
        {ACTIONS.map((a) => (
          <motion.li key={a.href} variants={item} role="none">
            <Link
              href={a.href}
              role="menuitem"
              onClick={onClose}
              className={
                a.featured
                  ? "group flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-600/25 to-emerald-500/10 px-4 py-3.5 hover:from-emerald-600/35 hover:to-emerald-500/20 transition-colors"
                  : "group flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3.5 hover:bg-surface transition-colors"
              }
            >
              <span
                aria-hidden="true"
                className={
                  a.featured
                    ? "grid place-items-center w-11 h-11 rounded-xl bg-emerald-500 text-white shrink-0"
                    : "grid place-items-center w-11 h-11 rounded-xl bg-surface text-text-dim group-hover:text-text shrink-0"
                }
              >
                {a.icon}
              </span>
              <span className={a.featured ? "flex-1 font-semibold text-emerald-100" : "flex-1 font-semibold text-text"}>
                {a.label}
              </span>
              <ChevronRight />
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </BottomSheet>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="text-text-mute shrink-0">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
