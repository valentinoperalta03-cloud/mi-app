import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "error";

const variantClass: Record<AlertVariant, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
  error: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100",
};

export function Alert({
  variant = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", variantClass[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
