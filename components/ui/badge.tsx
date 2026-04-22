import type { ReactNode } from "react";

type BadgeVariant = "brand" | "success" | "warning" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  brand: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

