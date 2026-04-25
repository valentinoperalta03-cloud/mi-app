type ErrorMessageProps = {
  message: string;
  type?: "error" | "warning" | "info" | "success";
  className?: string;
};

export function ErrorMessage({ message, type = "error", className = "" }: ErrorMessageProps) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300",
    warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300",
    info: "border-[#0585FC]/20 bg-[#0585FC]/5 text-[#0585FC] dark:border-[#0585FC]/30 dark:bg-[#0585FC]/10",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  };

  const icons = {
    error: "✕",
    warning: "⚠",
    info: "ℹ",
    success: "✓",
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${styles[type]} ${className}`}
    >
      <span className="shrink-0 font-bold">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}
