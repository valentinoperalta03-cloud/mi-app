import { SkeletonBlock } from "@/components/admin/ui-skeleton";
import { adminCard } from "@/components/admin/admin-premium";

type AdminPageSkeletonProps = {
  /** Number of list-card rows to show */
  listRows?: number;
  showList?: boolean;
};

export default function AdminPageSkeleton({
  listRows = 4,
  showList = true,
}: AdminPageSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy aria-label="Cargando">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-20 rounded-full" />
        <SkeletonBlock className="h-9 w-56 max-w-full rounded-2xl" />
        <SkeletonBlock className="h-4 w-full max-w-md rounded-xl" />
      </div>
      {showList ? (
        <ul className="flex flex-col gap-4">
          {Array.from({ length: listRows }).map((_, i) => (
            <li key={i} className={adminCard}>
              <div className="flex gap-4">
                <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SkeletonBlock className="h-5 w-36 rounded-lg" />
                    <SkeletonBlock className="h-7 w-24 rounded-full" />
                  </div>
                  <SkeletonBlock className="h-4 w-48 rounded-lg" />
                  <div className="grid grid-cols-3 gap-3">
                    <SkeletonBlock className="h-14 w-full rounded-xl" />
                    <SkeletonBlock className="h-14 w-full rounded-xl" />
                    <SkeletonBlock className="h-14 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={adminCard}>
          <SkeletonBlock className="h-40 w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
