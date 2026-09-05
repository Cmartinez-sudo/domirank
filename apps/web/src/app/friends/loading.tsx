import { Skeleton, SkeletonAvatar } from "@/components/Skeleton";

export default function FriendsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-28" />
      <div className="card space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 py-3">
          <SkeletonAvatar size={40} />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
