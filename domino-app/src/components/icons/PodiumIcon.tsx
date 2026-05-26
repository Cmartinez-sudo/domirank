/**
 * PodiumIcon — podio de 3 escalones (1°, 2°, 3°) para el bottom nav de Ranking.
 * SVG inline custom. strokeWidth=1.8 alineado con los SVG inline de AppShell.tsx.
 */

type Props = { size?: number; className?: string };

export function PodiumIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Centro alto: 1° */}
      <rect x="9" y="7" width="6" height="13" rx="1" />
      {/* Izquierda medio: 2° */}
      <rect x="3" y="11" width="6" height="9" rx="1" />
      {/* Derecha bajo: 3° */}
      <rect x="15" y="14" width="6" height="6" rx="1" />
      {/* Base */}
      <line x1="2" y1="20" x2="22" y2="20" />
      {/* "1" en el centro alto (línea vertical sutil) */}
      <line x1="12" y1="10" x2="12" y2="14" strokeWidth="2.5" />
    </svg>
  );
}
