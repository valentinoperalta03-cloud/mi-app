import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarDays, DollarSign, Settings, Target, Users } from "lucide-react";
import {
  adminCard,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { formatLongDateInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
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

const BRAND_LOGO_SRC = "/logo-marca.png";
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

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

  const today = getTodayYmdInArgentina();
  const todayLong = formatLongDateInArgentina();

  const { data: clubCourts } = await supabase
    .from(DB_TABLES.courts)
    .select("id")
    .eq("club_id", owned?.id ?? "");

  const courtIds = (clubCourts ?? []).map((c: { id: string }) => c.id);

  const { data: todayMatches } = courtIds.length > 0
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id, court_id, owner_id, total_price, payment_status, scheduled_time")
        .in("court_id", courtIds)
        .eq("scheduled_date", today)
        .eq("match_type", "reservation")
        .neq("match_status", "cancelled")
    : { data: [] };

  const todayRows = (todayMatches ?? []) as Array<{
    id: string;
    court_id: string;
    owner_id: string | null;
    total_price: number | null;
    payment_status: string | null;
    scheduled_time: string | null;
  }>;

  const reservasHoy = todayRows.length;
  const ingresosHoy = todayRows
    .filter((r) => String(r.payment_status ?? "").toLowerCase() === "paid")
    .reduce((sum, r) => sum + (r.total_price ?? 0), 0);
  const canchasOcupadas = new Set(todayRows.map((r) => r.court_id)).size;
  const canchasDisponibles = Math.max(0, courtIds.length - canchasOcupadas);
  const jugadoresActivos = new Set(todayRows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))
    .size;

  const bucketsByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0 }));
  for (const row of todayRows) {
    const raw = String(row.scheduled_time ?? "").trim();
    if (!raw) continue;
    const hour = Number(raw.slice(0, 2));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    bucketsByHour[hour].total += 1;
  }
  const hourlyBars = bucketsByHour.filter((b) => b.total > 0);
  const chartData = hourlyBars.length > 0 ? hourlyBars : bucketsByHour.slice(8, 23);
  const maxHourly = Math.max(1, ...chartData.map((b) => b.total));

  const todayMetrics = [
    { label: "Reservas hoy", value: String(reservasHoy), icon: Target, color: "text-sky-700" },
    { label: "Ingresos hoy", value: money.format(ingresosHoy), icon: DollarSign, color: "text-emerald-700" },
    {
      label: "Canchas hoy",
      value: `${canchasOcupadas} ocupadas / ${canchasDisponibles} libres`,
      icon: Activity,
      color: "text-violet-700",
    },
    { label: "Jugadores activos", value: String(jugadoresActivos), icon: Users, color: "text-amber-700" },
  ] as const;

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
      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-sky-100/50 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
              <CalendarDays size={15} className="text-sky-600" strokeWidth={2.25} />
              {todayLong}
            </div>
            <h1 className={adminTitle}>Panel de administración</h1>
            <p className={`${adminSubtitle} max-w-xl`}>
              Seguimiento diario de reservas, ingresos y ocupación del club en tiempo real.
            </p>
          </div>
          <div className="relative h-14 w-40 shrink-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-2">
            <Image
              src={BRAND_LOGO_SRC}
              alt="Logo de marca"
              fill
              className="object-contain p-2 opacity-80"
            />
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Tu marca
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {todayMetrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${adminCard} flex flex-col gap-2 p-4`}>
            <Icon size={18} className={color} strokeWidth={2} />
            <p className={adminKicker}>{label}</p>
            <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className={`${adminCard} p-5`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className={`${adminKicker} text-slate-500`}>Actividad del día</p>
            <h2 className="text-lg font-bold text-slate-900">Reservas por hora</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            Total: <span className="text-slate-800">{reservasHoy}</span>
          </p>
        </div>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {chartData.map((item) => (
            <div key={item.hour} className="flex min-w-10 flex-col items-center gap-2">
              <div className="flex h-40 w-8 items-end rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60">
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-sky-600 to-cyan-400"
                  style={{ height: `${Math.max(6, (item.total / maxHourly) * 100)}%` }}
                  title={`${item.total} reservas`}
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{String(item.hour).padStart(2, "0")}h</p>
              <p className="text-xs font-bold text-slate-700">{item.total}</p>
            </div>
          ))}
        </div>
      </section>

      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
          <Target size={15} className="text-sky-600" strokeWidth={2.25} />
          Módulos de gestión
        </div>
        <h2 className={adminTitle}>Tu operación, en un solo lugar</h2>
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
