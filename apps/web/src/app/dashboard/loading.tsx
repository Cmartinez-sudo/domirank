import { Skeleton, SkeletonCard, SkeletonMatchItem } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Global rating card skeleton */}
      <div className="card" style={{ borderColor: "rgba(16,185,129,.2)" }}>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-14 w-32 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="card">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMatchItem key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
