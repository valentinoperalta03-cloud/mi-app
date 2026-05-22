type SkeletonBlockProps = {
  className?: string;
};

function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`.trim()} aria-hidden />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 ${className}`.trim()}
      aria-hidden
    >
      <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonBlock className="h-4 w-[62%] max-w-[12rem]" />
        <SkeletonBlock className="h-3 w-[80%] max-w-[16rem]" />
        <SkeletonBlock className="h-3 w-[42%] max-w-[8rem]" />
      </div>
    </div>
  );
}

export function SkeletonList({
  rows = 4,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl px-1 py-1">
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <SkeletonBlock className="h-3.5 w-[55%]" />
            <SkeletonBlock className="h-3 w-[38%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonProfile({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`.trim()} aria-hidden>
      <SkeletonBlock className="h-24 w-24 rounded-full" />
      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        <SkeletonBlock className="h-5 w-2/3" />
        <SkeletonBlock className="h-3.5 w-1/2" />
      </div>
      <div className="mt-2 flex w-full flex-col gap-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-[92%]" />
        <SkeletonBlock className="h-3 w-[78%]" />
      </div>
    </div>
  );
}
