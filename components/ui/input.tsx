import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "form-input w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none ring-0 transition placeholder:text-[var(--text-tertiary)] focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/25",
        className
      )}
      {...props}
    />
  );
}
