import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "default" | "interactive" | "highlight";

const variantClass: Record<CardVariant, string> = {
  default: "border border-slate-200/80 bg-[var(--bg-card)] shadow-sm dark:border-slate-700",
  interactive:
    "cursor-pointer border border-slate-200/80 bg-[var(--bg-card)] shadow-sm transition hover:border-[var(--color-brand)]/40 hover:shadow-md dark:border-slate-700",
  highlight:
    "border border-[var(--color-brand)]/25 bg-[var(--color-brand-light)] shadow-sm dark:border-[var(--color-brand)]/35 dark:bg-slate-900/40",
};

export function Card({
  variant = "default",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl p-5", variantClass[variant], className)} {...props}>
      {children}
    </div>
  );
}
