/**
 * Iconos de DomiRank — Lucide-style stroke 1.6, 24px default.
 * Reemplazan emojis que se usaban como íconos funcionales (empty states,
 * status badges, etc.). Los emojis decorativos sin función UI pueden quedarse.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Pelota de dominó / ficha — empty state de partidas/juego */
export function GameIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <circle cx="7.5" cy="9.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="14.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="9.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </Base>
  );
}

/** Handshake / amigos */
export function FriendsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 11h.01" />
      <path d="M3 12c0-1.5 1-3 3-3l3 1 4-4 4 1c2 0 3.5 1.5 3.5 3.5L20 12l-3 6-4-2-3 2-4-3z" />
    </Base>
  );
}

/** Inbox / solicitudes recibidas */
export function InboxIcon(props: IconProps) {
  return (
    <Base {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Base>
  );
}

/** Send / solicitudes enviadas */
export function SendIcon(props: IconProps) {
  return (
    <Base {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Base>
  );
}

/** Bell-off / sin notificaciones */
export function BellOffIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Base>
  );
}

/** Hourglass / pendiente / esperando */
export function PendingIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Base>
  );
}

/** Check circle — confirmado */
export function CheckCircleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Base>
  );
}

/** Alert triangle — disputa / problema */
export function AlertTriangleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Base>
  );
}

/** Slash / anulado / void */
export function SlashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </Base>
  );
}

/** Flask / beta / experimental */
export function FlaskIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 2v7.5L4 18a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L15 9.5V2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <line x1="6.5" y1="15" x2="17.5" y2="15" />
    </Base>
  );
}

/** Target — onboarding/objetivo */
export function TargetIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Base>
  );
}

/** Trophy — celebración / éxito */
export function TrophyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Base>
  );
}
