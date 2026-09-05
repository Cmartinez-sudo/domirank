export function LeaderboardSkeleton() {
  return (
    <div className="divide-y divide-border animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {/* rank */}
          <span className="w-7 h-7 rounded-full bg-surface-3 shrink-0" />
          {/* avatar */}
          <span className="w-7 h-7 rounded-full bg-surface-3 shrink-0" />
          {/* nombre */}
          <span className="flex-1 h-4 rounded-lg bg-surface-3 max-w-[120px]" />
          {/* stats */}
          <span className="hidden sm:block h-4 w-16 rounded-lg bg-surface-3" />
          <span className="hidden sm:block h-4 w-12 rounded-lg bg-surface-3" />
          <span className="hidden sm:block h-4 w-10 rounded-lg bg-surface-3" />
          <span className="hidden sm:block h-4 w-10 rounded-lg bg-surface-3" />
          <span className="hidden sm:block h-4 w-10 rounded-lg bg-surface-3" />
          <span className="h-5 w-8 rounded-full bg-surface-3" />
        </div>
      ))}
    </div>
  );
}
