export function HomeSuggestionsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-40 w-40 shrink-0 animate-pulse rounded-[2rem] bg-slate-200/50"
        />
      ))}
    </div>
  );
}

export function HomeSummarySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-[2rem] bg-slate-200/50"
        />
      ))}
    </div>
  );
}
