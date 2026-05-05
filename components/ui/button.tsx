import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "text-white shadow-[0_2px_8px_rgba(5,133,252,0.35)] hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-60",
  secondary:
    "border border-[var(--color-brand)]/30 bg-[var(--bg-card)] text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-light)] dark:border-[var(--color-brand)]/40",
  ghost: "text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-light)] dark:text-sky-300",
  destructive:
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700",
};

const variantStyle: Record<ButtonVariant, CSSProperties | undefined> = {
  primary: { background: "var(--color-brand-gradient)" },
  secondary: undefined,
  ghost: undefined,
  destructive: undefined,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "rounded-xl px-3 py-2 text-xs font-semibold",
  md: "rounded-2xl px-4 py-3 text-sm font-semibold",
  lg: "rounded-2xl px-5 py-3.5 text-base font-semibold",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 transition disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      style={{ ...variantStyle[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
