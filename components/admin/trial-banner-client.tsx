"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminCTAPrimary } from "@/components/admin/admin-premium";

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
      className={`mb-4 flex flex-col gap-3 rounded-xl border-l-[3px] p-4 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between ${
        isCritical
          ? "border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] text-[var(--text-error)]"
          : "border-[#0085FC] bg-[rgba(0,133,252,0.06)] text-[#0461C4] dark:border-[#CCFF00] dark:bg-[rgba(204,255,0,0.07)] dark:text-[#CCFF00]"
      }`}
    >
      <span>
        {isCritical ? "🔴" : "🔵"} {message}
      </span>
      {isCritical ? (
        <Link
          href="/admin/facturacion"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          Activar suscripción
        </Link>
      ) : (
        <Link href="/admin/facturacion" className={`inline-flex shrink-0 items-center justify-center text-xs ${adminCTAPrimary}`}>
          Activar suscripción
        </Link>
      )}
    </div>
  );
}
