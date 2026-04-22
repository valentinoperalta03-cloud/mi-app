export default function MatchDetailLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-28 pt-6">
      <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />

      <div className="space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-6 w-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-52 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-4 w-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-5 w-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-8 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>

      <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

