interface RankBadgeProps {
  rank: number;
}

const MEDAL: Record<number, { bg: string; color: string; ring?: string }> = {
  1: { bg: "rgba(245,184,0,.15)", color: "#f5b800", ring: "ring-2 ring-[#f5b800]/40" },
  2: { bg: "rgba(209,213,219,.12)", color: "#d1d5db" },
  3: { bg: "rgba(205,127,50,.14)", color: "#cd7f32" },
};

export function RankBadge({ rank }: RankBadgeProps) {
  const medal = MEDAL[rank];

  if (medal) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
        style={{ background: medal.bg, color: medal.color }}
      >
        {rank}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 bg-surface-2 text-text-mute">
      {rank}
    </span>
  );
}

/** Devuelve el className de anillo dorado para el avatar del #1 */
export function goldRingClass(rank: number): string {
  return rank === 1 ? "ring-2 ring-[#f5b800]/40" : "";
}
