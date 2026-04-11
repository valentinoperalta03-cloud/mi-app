import { adminCard } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Cargando panel">
      <div className="space-y-3">
        <SkeletonBlock className="h-8 w-40 rounded-full" />
        <SkeletonBlock className="h-10 w-full max-w-sm rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-md rounded-xl" />
      </div>
      <ul className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className={adminCard}>
            <SkeletonBlock className="h-12 w-12 rounded-2xl" />
            <SkeletonBlock className="mt-4 h-5 w-32 rounded-lg" />
            <SkeletonBlock className="mt-3 h-16 w-full rounded-xl" />
            <SkeletonBlock className="mt-5 h-4 w-16 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  );
}
