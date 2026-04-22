export default function AdminCourtScheduleLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-5 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />

      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-4 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="h-10 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-10 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-11 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

