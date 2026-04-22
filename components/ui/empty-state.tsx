import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-slate-50 p-4 dark:bg-slate-800/50">
        <Icon className="h-12 w-12 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </section>
  );
}

