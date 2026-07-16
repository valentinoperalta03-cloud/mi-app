import { adminCard } from "@/components/admin/admin-premium";

export default function AdminCourtScheduleLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-5 w-36 animate-pulse rounded-full bg-[var(--bg-subtle)]" />

      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--bg-subtle)]" />
        <div className="h-8 w-64 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
        <div className="h-4 w-72 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
      </div>

      <div className={adminCard}>
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[var(--border-subtle)] p-4"
            >
              <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--bg-subtle)]" />
              <div className="mt-3 h-4 w-20 animate-pulse rounded-full bg-[var(--bg-subtle)]" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="h-10 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
                <div className="h-10 animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-11 w-full animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
      </div>
    </div>
  );
}

