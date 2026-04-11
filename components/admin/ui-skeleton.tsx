/** Pulse / shimmer blocks for admin loading states. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} aria-hidden />;
}
