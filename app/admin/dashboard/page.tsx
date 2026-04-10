import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, DollarSign, Settings, Target, Users } from "lucide-react";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const modules = [
  {
    href: "/admin/reservas",
    title: "Reservas",
    description: "Agenda de partidos, estado de pago y bloqueo manual de canchas.",
    icon: Target,
    accent: "from-sky-500/15 to-cyan-500/10 border-sky-200/60",
    iconBg: "bg-sky-500/10 text-sky-700",
  },
  {
    href: "/admin/finanzas",
    title: "Finanzas",
    description: "Ingresos por periodo, por cancha y comparativa mes a mes.",
    icon: DollarSign,
    accent: "from-emerald-500/12 to-teal-500/10 border-emerald-200/60",
    iconBg: "bg-emerald-500/10 text-emerald-800",
  },
  {
    href: "/admin/analytics",
    title: "Ocupacion",
    description: "KPIs de uso, horas pico y huecos para promociones.",
    icon: Activity,
    accent: "from-violet-500/12 to-indigo-500/10 border-violet-200/60",
    iconBg: "bg-violet-500/10 text-violet-700",
  },
  {
    href: "/admin/jugadores",
    title: "Jugadores",
    description: "Fidelidad, ultima actividad y segmento nuevo vs recurrente.",
    icon: Users,
    accent: "from-amber-500/15 to-orange-500/10 border-amber-200/60",
    iconBg: "bg-amber-500/10 text-amber-800",
  },
  {
    href: "/admin/config",
    title: "Configuracion",
    description: "Horarios operativos, grilla de turnos e indicadores del club.",
    icon: Settings,
    accent: "from-slate-500/10 to-slate-400/10 border-slate-200/70",
    iconBg: "bg-slate-500/10 text-slate-700",
  },
] as const;

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!owned) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Sin club asignado</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          No encontramos un club donde seas titular. Si acabas de configurar tu cuenta, revisa
          permisos en la base o contacta soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
          <Target size={14} className="text-sky-600" />
          Panel del club
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Tu operacion, en un solo lugar
        </h1>
        <p className="max-w-lg text-sm font-medium text-slate-500">
          Elegi un modulo. Los datos se filtran por las canchas de tu club.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={`group flex h-full flex-col rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${section.accent}`}
              >
                <span
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${section.iconBg}`}
                >
                  <Icon size={22} strokeWidth={2} />
                </span>
                <span className="text-base font-semibold text-slate-900">{section.title}</span>
                <span className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  {section.description}
                </span>
                <span className="mt-4 text-sm font-semibold text-sky-600 group-hover:text-sky-500">
                  Abrir
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Accesos rapidos</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-600">
          <Link href="/club/gestion" className="text-sky-600 hover:text-sky-500">
            Grilla de turnos
          </Link>
          <Link href="/club/horarios" className="text-sky-600 hover:text-sky-500">
            Horarios de canchas
          </Link>
          <Link href="/club/partidos" className="text-sky-600 hover:text-sky-500">
            Lista de partidos
          </Link>
        </div>
      </section>
    </div>
  );
}
