import Link from "next/link";
import { Shield } from "lucide-react";
import { getSuperadminUser } from "@/lib/superadmin/guards";

/** Enlace al panel superadmin; solo visible para emails autorizados. */
export default async function SuperadminEntryLink({ variant = "player" }: { variant?: "player" | "admin" }) {
  const user = await getSuperadminUser();
  if (!user) return null;

  if (variant === "admin") {
    return (
      <Link
        href="/superadmin"
        className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/40 transition hover:border-cyan-400/50"
      >
        <Shield className="size-5 shrink-0 text-cyan-400" aria-hidden />
        <span>
          Panel Superadmin
          <span className="mt-0.5 block text-xs font-normal text-slate-400">Métricas globales y gestión PadeLibre</span>
        </span>
      </Link>
    );
  }

  return (
    <section className="rounded-[2.5rem] border border-cyan-500/25 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-lg shadow-cyan-950/30">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 size-5 shrink-0 text-cyan-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">Panel Superadmin</h2>
          <p className="mt-1 text-sm text-slate-400">Gestión global de clubes, finanzas y usuarios de PadeLibre.</p>
          <Link
            href="/superadmin"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Abrir superadmin
          </Link>
        </div>
      </div>
    </section>
  );
}
