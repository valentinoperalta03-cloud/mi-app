"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TrialBannerClient({
  variant,
  daysLeft,
}: {
  variant: "warning" | "critical";
  daysLeft: number;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/facturacion" || pathname.startsWith("/admin/facturacion/")) return null;

  const diasLabel = daysLeft === 1 ? "día" : "días";
  const message =
    daysLeft <= 0
      ? "Tu período de prueba vence hoy. Activá tu suscripción para seguir usando PadeLibre."
      : variant === "critical"
        ? `Tu período de prueba vence en ${daysLeft} ${diasLabel}. Activá tu suscripción ahora.`
        : `Tu período de prueba vence en ${daysLeft} ${diasLabel}. Activá tu suscripción para no perder el acceso.`;

  const isCritical = variant === "critical";

  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-2xl border p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${
        isCritical
          ? "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
          : "border-[var(--admin-accent-lima-border)] bg-[var(--admin-accent-lima-subtle)] text-[var(--admin-status-active-text)]"
      }`}
    >
      <span>
        {isCritical ? "🔴" : "🟡"} {message}
      </span>
      <Link
        href="/admin/facturacion"
        className={`inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 ${
          isCritical
            ? "bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
            : "bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
        }`}
      >
        Activar suscripción
      </Link>
    </div>
  );
}
