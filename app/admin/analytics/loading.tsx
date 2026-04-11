import { adminCard } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando analytics">
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-9 w-64 max-w-full rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-lg rounded-xl" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-4 w-40 rounded-lg" />
        <SkeletonBlock className="mt-4 h-12 w-28 rounded-2xl" />
        <SkeletonBlock className="mt-4 h-3 w-full rounded-full" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-5 w-48 rounded-lg" />
        <div className="mt-6 flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-24 w-14 shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
