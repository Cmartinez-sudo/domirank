interface StreakChipProps {
  /** Formato "3W" | "1L" | "0W" etc. */
  streak: string;
}

export function StreakChip({ streak }: StreakChipProps) {
  const result = streak.slice(-1); // último carácter: "W" o "L"
  const count = streak.slice(0, -1); // número

  if (!count || count === "0") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-text-mute">
        —
      </span>
    );
  }

  if (result === "W") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary whitespace-nowrap">
        {count}W
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger whitespace-nowrap">
      {count}L
    </span>
  );
}
