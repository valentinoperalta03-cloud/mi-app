import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: matchesRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("date")
          .in("court_id", ctx.courtIds)
          .order("date", { ascending: true })
      : { data: [] };

  const dates = (matchesRaw ?? []) as { date: string }[];
  const byMonth = new Map<string, number>();
  for (const { date } of dates) {
    const mk = format(parseISO(date), "yyyy-MM");
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
  }
  const monthKeys = Array.from(byMonth.keys()).sort();
  const growth = monthKeys.map((k) => ({
    key: k,
    label: format(parseISO(`${k}-01T12:00:00`), "MMM yyyy", { locale: es }),
    count: byMonth.get(k) ?? 0,
  }));
  const maxG = growth.reduce((m, x) => Math.max(m, x.count), 0);

  return (
    <div className="space-y-8">
      <AdminBackLink />
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuracion</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          <Settings2 className="text-slate-400" size={28} strokeWidth={2} />
          Club y canchas
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Accesos directos a horarios operativos y gestion de turnos.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/club/horarios"
          className="group flex h-full flex-col rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-500/12 to-cyan-500/8 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-300/80 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-sky-700">Horarios</p>
          <p className="mt-1 text-base font-semibold text-slate-900">Configuracion de canchas</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Apertura y cierre por dia (<code className="text-xs text-slate-500">court_schedules</code>
            ).
          </p>
          <span className="mt-4 text-sm font-semibold text-sky-600 group-hover:text-sky-500">
            Abrir
          </span>
        </Link>
        <Link
          href="/club/gestion"
          className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-500/8 to-slate-400/6 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-slate-600">Turnos</p>
          <p className="mt-1 text-base font-semibold text-slate-900">Gestion de disponibilidad</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Grilla del dia, bloqueos manuales y estado frente a partidos reservados.
          </p>
          <span className="mt-4 text-sm font-semibold text-sky-600 group-hover:text-sky-500">
            Abrir
          </span>
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          Volumen de Actividad Mensual
        </h2>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">
          Partidos jugados en tus canchas por mes: es la metrica que mejor refleja uso y rentabilidad
          operativa del club.
        </p>
        <div className="mt-5 space-y-3.5">
          {growth.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">Sin datos aun.</p>
          ) : (
            growth.map((g) => (
              <div key={g.key} className="space-y-1.5">
                <div className="flex justify-between text-sm font-semibold text-slate-700">
                  <span className="text-slate-600">{g.label}</span>
                  <span className="tabular-nums text-slate-800">{g.count} partidos</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-300/90 via-sky-400/85 to-sky-500/75"
                    style={{
                      width: `${maxG > 0 ? Math.max(8, (g.count / maxG) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
