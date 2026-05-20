"use client";

import { motion, type Variants } from "framer-motion";

const pulse: Variants = {
  animate: {
    opacity: [0.5, 0.8, 0.5],
    transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const },
  },
};

function SkeletonBase({ className }: { className?: string }) {
  return (
    <motion.div
      variants={pulse}
      animate="animate"
      className={`bg-surface-2 rounded-md ${className ?? ""}`}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <SkeletonBase className={className} />;
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <motion.div
      variants={pulse}
      animate="animate"
      className="rounded-full bg-surface-2 shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <SkeletonBase className="w-6 h-4 shrink-0" />
      <SkeletonAvatar size={32} />
      <div className="flex-1 space-y-1.5">
        <SkeletonBase className="h-3.5 w-32" />
        <SkeletonBase className="h-2.5 w-20" />
      </div>
      <SkeletonBase className="h-4 w-10 shrink-0" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonAvatar size={44} />
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-4 w-36" />
          <SkeletonBase className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBase key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMatchItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <SkeletonBase className="h-4 w-16 shrink-0" />
      <SkeletonBase className="h-4 flex-1" />
      <SkeletonBase className="h-4 w-12 shrink-0" />
    </div>
  );
}
