import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, DollarSign, Settings, Target, Users } from "lucide-react";
import {
  adminCard,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const modules = [
  {
    href: "/admin/reservas",
    title: "Reservas",
    description: "Agenda de partidos, estado de pago y bloqueo manual de canchas.",
    icon: Target,
    accent: "from-sky-500/14 to-cyan-500/10 border-sky-200/55",
    iconBg: "bg-sky-500/12 text-sky-700 ring-1 ring-sky-200/40",
  },
  {
    href: "/admin/finanzas",
    title: "Finanzas",
    description: "Ingresos por periodo, por cancha y comparativa mes a mes.",
    icon: DollarSign,
    accent: "from-emerald-500/12 to-teal-500/10 border-emerald-200/55",
    iconBg: "bg-emerald-500/12 text-emerald-800 ring-1 ring-emerald-200/40",
  },
  {
    href: "/admin/analytics",
    title: "Ocupación",
    description: "KPIs de uso, horas pico y huecos para promociones.",
    icon: Activity,
    accent: "from-violet-500/12 to-indigo-500/10 border-violet-200/55",
    iconBg: "bg-violet-500/12 text-violet-700 ring-1 ring-violet-200/40",
  },
  {
    href: "/admin/jugadores",
    title: "Jugadores",
    description: "Fidelidad, última actividad y segmento nuevo vs recurrente.",
    icon: Users,
    accent: "from-amber-500/14 to-orange-500/10 border-amber-200/55",
    iconBg: "bg-amber-500/12 text-amber-800 ring-1 ring-amber-200/40",
  },
  {
    href: "/admin/config",
    title: "Configuración",
    description: "Horarios operativos, grilla de turnos e indicadores del club.",
    icon: Settings,
    accent: "from-slate-500/10 to-slate-400/8 border-slate-200/65",
    iconBg: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-200/45",
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
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90`}>
        <h1 className="text-lg font-bold text-slate-900">Sin club asignado</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          No encontramos un club donde seas titular. Si acabas de configurar tu cuenta, revisa
          permisos en la base o contacta soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
          <Target size={15} className="text-sky-600" strokeWidth={2.25} />
          Panel del club
        </div>
        <h1 className={adminTitle}>Tu operación, en un solo lugar</h1>
        <p className={`${adminSubtitle} max-w-lg`}>
          Elegí un módulo. Los datos se filtran por las canchas de tu club.
        </p>
      </header>

      <ul className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {modules.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={`group flex h-full flex-col rounded-2xl border bg-gradient-to-br p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.1)] backdrop-blur-[2px] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-12px_rgba(15,23,42,0.14)] ${section.accent}`}
              >
                <span
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${section.iconBg}`}
                >
                  <Icon size={24} strokeWidth={2} />
                </span>
                <span className="text-base font-bold text-slate-900">{section.title}</span>
                <span className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  {section.description}
                </span>
                <span className="mt-5 text-sm font-semibold text-sky-600 group-hover:text-sky-500">
                  Abrir
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className={adminCard}>
        <p className={adminKicker}>Accesos rápidos</p>
        <div className="mt-4 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
          <Link
            href="/club/gestion"
            className={`text-sky-600 hover:text-sky-500 ${adminPressable} inline-flex w-fit rounded-full px-1 py-0.5`}
          >
            Grilla de turnos
          </Link>
          <Link
            href="/club/horarios"
            className={`text-sky-600 hover:text-sky-500 ${adminPressable} inline-flex w-fit rounded-full px-1 py-0.5`}
          >
            Horarios de canchas
          </Link>
          <Link
            href="/club/partidos"
            className={`text-sky-600 hover:text-sky-500 ${adminPressable} inline-flex w-fit rounded-full px-1 py-0.5`}
          >
            Lista de partidos
          </Link>
        </div>
      </section>
    </div>
  );
}
