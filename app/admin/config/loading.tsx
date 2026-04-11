import { adminCard } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

export default function ConfigLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando configuración">
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-28 rounded-full" />
        <SkeletonBlock className="h-10 w-56 max-w-full rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-md rounded-xl" />
      </div>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-5 w-52 rounded-lg" />
        <SkeletonBlock className="mt-6 h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
