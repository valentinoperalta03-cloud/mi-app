import { adminCard } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

export default function JugadoresLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando jugadores">
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-14 rounded-full" />
        <SkeletonBlock className="h-9 w-44 max-w-full rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-md rounded-xl" />
      </div>
      <ul className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={adminCard}>
            <div className="flex gap-4">
              <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex justify-between gap-2">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-6 w-40 rounded-lg" />
                    <SkeletonBlock className="h-3 w-28 rounded-md" />
                  </div>
                  <SkeletonBlock className="h-7 w-28 shrink-0 rounded-full" />
                </div>
                <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
                  <SkeletonBlock className="h-14 w-full rounded-xl" />
                  <SkeletonBlock className="h-14 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
