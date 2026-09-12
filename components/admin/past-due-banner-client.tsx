"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PastDueBannerClient({
  daysLeft,
  reasonLabel,
}: {
  daysLeft: number;
  reasonLabel: string;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/config/suscripcion") return null;

  const diasLabel = daysLeft === 1 ? "día" : "días";
  const message =
    daysLeft <= 0
      ? `${reasonLabel} El plazo para regularizar tu pago está por vencer.`
      : `${reasonLabel} Tu club sigue activo por ${daysLeft} ${diasLabel} más.`;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border-l-[3px] border-rose-600 bg-rose-50 px-5 py-2 text-[13px] font-semibold text-rose-800 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-300">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-rose-600 dark:bg-rose-400" />
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <Link
        href="/admin/config/suscripcion"
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-rose-700 px-3.5 py-[5px] text-[13px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
      >
        Ver detalle
      </Link>
    </div>
  );
}
