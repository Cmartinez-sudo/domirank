import { Skeleton, SkeletonRow } from "@/components/Skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-64 rounded-md" />
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-full max-w-xs" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
