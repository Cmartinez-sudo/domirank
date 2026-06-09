"use client";

import { useRouter, usePathname } from "next/navigation";
import { useActiveMatch } from "@/hooks/useActiveMatch";

type Props = {
  userId: string | null;
};

/**
 * Floating pill bottom-right — Spec C8.
 *
 * Dos estados visuales según `status`:
 *   • in_progress (nadie llegó al target todavía) → pill verde
 *     "PARTIDA EN CURSO" + pulse rojo "live" + score actual.
 *     Tap → /matches/{id}/live (seguir scoreando).
 *
 *   • pending_attestation (ya hay ganador, falta firma) → pill ámbar
 *     "FIRMAR RESULTADO" sin pulse (no es live). Tap → /matches/{id}
 *     (panel de attestation, no /live).
 *
 * Visible cuando:
 *   • Hay active match para el viewer.
 *   • El viewer NO está ya en /matches/{id}/...
 *   • El viewer NO está en /onboarding ni rutas de auth.
 *
 * Espectadores: useActiveMatch retorna null → chip no aparece.
 */
export function ActiveMatchChip({ userId }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { activeMatch, scoreA, scoreB } = useActiveMatch(userId);

  if (!activeMatch) return null;

  const alreadyInside = pathname.startsWith(`/matches/${activeMatch.match_id}`);
  if (alreadyInside) return null;

  if (pathname.startsWith("/onboarding") || pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  const awaitingAttestation = activeMatch.status === "pending_attestation";
  const target = awaitingAttestation
    ? `/matches/${activeMatch.match_id}`
    : `/matches/${activeMatch.match_id}/live`;

  const label = awaitingAttestation ? "Firmar resultado" : "Partida en curso";
  const ariaLabel = awaitingAttestation
    ? `Firmar resultado de la partida. Marcador ${scoreA} a ${scoreB}.`
    : `Volver a la partida en curso. Score ${scoreA} a ${scoreB}.`;

  // Color tokens: verde brand para in_progress (vivo), ámbar para
  // pending_attestation (acción pendiente, no urgente-roja).
  const bg = awaitingAttestation ? "rgba(245,158,11,0.95)" : "rgba(16,185,129,0.95)";

  return (
    <button
      type="button"
      onClick={() => router.push(target)}
      className="inline-flex items-center gap-2 rounded-full pl-3 pr-3.5 py-2 shadow-pop font-semibold text-[13px] tracking-tight transition-transform active:scale-95"
      style={{
        background: bg,
        color: "#0f1c2e",
        minHeight: 44,
      }}
      aria-label={ariaLabel}
    >
      {awaitingAttestation ? (
        // Icon pendiente: pluma/check — comunicación "acción esperando"
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ) : (
        // Pulse dot rojo: "live" indicator
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}

      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
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
