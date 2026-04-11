import { adminCard } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

export default function FinanzasLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando finanzas">
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-9 w-64 max-w-full rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-lg rounded-xl" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-5 w-48 rounded-lg" />
        <SkeletonBlock className="mt-5 h-12 w-full rounded-2xl" />
        <SkeletonBlock className="mt-3 h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}
