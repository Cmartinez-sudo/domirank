"use client";

import { useRouter, usePathname } from "next/navigation";
import { useActiveMatch } from "@/hooks/useActiveMatch";

type Props = {
  userId: string | null;
};

/**
 * Floating pill bottom-right — Spec C8.
 *
 * Visible cuando:
 *   • Hay active match para el viewer.
 *   • El viewer NO está ya en /matches/{activeMatch}/...
 *   • El viewer NO está en /onboarding ni rutas de auth.
 *
 * Tap → navegamos a /matches/{id}/live.
 * Score se actualiza vía realtime (useActiveMatch hook).
 */
export function ActiveMatchChip({ userId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { activeMatch, scoreA, scoreB } = useActiveMatch(userId);

  if (!activeMatch) return null;

  // Skip render cuando ya estamos en el match activo (no es redundante mostrar
  // "ir a la partida" si ya estás ahí).
  const alreadyInside = pathname.startsWith(`/matches/${activeMatch.match_id}`);
  if (alreadyInside) return null;

  // Skip en pantallas auth/onboarding.
  if (pathname.startsWith("/onboarding") || pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  const target = `/matches/${activeMatch.match_id}/live`;

  return (
    <button
      type="button"
      onClick={() => router.push(target)}
      className="inline-flex items-center gap-2 rounded-full pl-3 pr-3.5 py-2 shadow-pop font-semibold text-[13px] tracking-tight transition-transform active:scale-95"
      style={{
        background: "rgba(16,185,129,0.95)",
        color: "#0f1c2e",
        minHeight: 44,
      }}
      aria-label={`Volver a la partida en curso. Score ${scoreA} a ${scoreB}.`}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] uppercase tracking-wider opacity-80">Partida en curso</span>
        <span className="font-mono tabular-nums text-base mt-0.5">
          {scoreA} — {scoreB}
        </span>
      </span>
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        className="opacity-80"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
