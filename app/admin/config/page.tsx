import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, LogOut, Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import {
  adminCard,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

async function signOutAction() {
  "use server";
  const supabase = await createClient({ allowCookieWrites: true });
  await supabase.auth.signOut();
  redirect("/login");
}

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
  const { data: clubData } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.clubs)
        .select("mp_access_token,mp_user_id")
        .eq("id", ctx.clubIds[0])
        .maybeSingle()
    : { data: null };
  const isMpConnected = Boolean((clubData as { mp_access_token?: string | null } | null)?.mp_access_token);
  const mpUserId = (clubData as { mp_user_id?: string | null } | null)?.mp_user_id ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={`${adminTitle} flex flex-wrap items-center gap-3`}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
            <Settings2 size={24} strokeWidth={2} aria-hidden />
          </span>
          Club y canchas
        </h1>
        <p className={adminSubtitle}>
          Accesos directos a horarios operativos y gestión de turnos.
        </p>
      </header>

      <section className="flex flex-col gap-4 md:grid md:grid-cols-2">
        <div
          className={`flex h-full flex-col rounded-2xl border p-6 ${
            isMpConnected
              ? "border-emerald-200/70 bg-emerald-50/70"
              : "border-amber-200/70 bg-amber-50/70"
          }`}
        >
          <div className="flex items-center gap-2">
            {isMpConnected ? (
              <CheckCircle size={18} className="text-emerald-600" />
            ) : (
              <AlertCircle size={18} className="text-amber-600" />
            )}
            <p className={`text-sm font-semibold ${isMpConnected ? "text-emerald-700" : "text-amber-700"}`}>
              {isMpConnected ? "Mercado Pago conectado ✓" : "Sin conectar"}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {isMpConnected ? `MP User ID: ${mpUserId}` : "Conectá tu cuenta para cobrar reservas del club."}
          </p>
        </div>
        <Link
          href="/admin/config/mp-connect"
          className={`group flex h-full flex-col rounded-2xl border border-emerald-200/55 bg-gradient-to-br from-emerald-500/10 to-teal-500/8 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(16,185,129,0.1)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:border-emerald-300/80 hover:shadow-lg`}
        >
          <p className="text-sm font-semibold text-emerald-700">Cobros</p>
          <p className="mt-2 text-base font-bold text-slate-900">Mercado Pago</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Conectá la cuenta del club para cobrar reservas con split de comisión.
          </p>
          <span className="mt-5 text-sm font-semibold text-emerald-600 group-hover:text-emerald-500">
            {isMpConnected ? "Reconectar" : "Conectar"}
          </span>
        </Link>
        <Link
          href="/admin/club"
          className={`group flex h-full flex-col rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(59,130,246,0.12)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:border-indigo-300/80 hover:shadow-lg`}
        >
          <p className="text-sm font-semibold text-indigo-700">Club</p>
          <p className="mt-2 text-base font-bold text-slate-900">Información del club</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Editá nombre, contacto, imágenes y horarios de atención.
          </p>
          <span className="mt-5 text-sm font-semibold text-indigo-600">Abrir</span>
        </Link>
        <Link
          href="/admin/pagos"
          className={`group flex h-full flex-col rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 to-lime-500/10 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(16,185,129,0.12)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:border-emerald-300/80 hover:shadow-lg`}
        >
          <p className="text-sm font-semibold text-emerald-700">Tesorería</p>
          <p className="mt-2 text-base font-bold text-slate-900">Historial de pagos</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Revisá pagos aprobados, pendientes y reembolsos por mes.
          </p>
          <span className="mt-5 text-sm font-semibold text-emerald-600">Abrir</span>
        </Link>
        <Link
          href="/club/horarios"
          className={`group flex h-full flex-col rounded-2xl border border-[#0585FC]/20/55 bg-gradient-to-br from-[#0585FC]/12 to-cyan-500/8 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(14,165,233,0.12)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:border-[#0585FC]/30/80 hover:shadow-lg`}
        >
          <p className="text-sm font-semibold text-[#0461C4]">Horarios</p>
          <p className="mt-2 text-base font-bold text-slate-900">Configuración de canchas</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Apertura y cierre por día (
            <code className="text-xs text-slate-500">court_schedules</code>).
          </p>
          <span className="mt-5 text-sm font-semibold text-[#0585FC] group-hover:text-[#0585FC]">
            Abrir
          </span>
        </Link>
        <Link
          href="/club/gestion"
          className={`group flex h-full flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-500/8 to-slate-400/6 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.08)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-lg`}
        >
          <p className="text-sm font-semibold text-slate-600">Turnos</p>
          <p className="mt-2 text-base font-bold text-slate-900">Gestión de disponibilidad</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            Grilla del día, bloqueos manuales y estado frente a partidos reservados.
          </p>
          <span className="mt-5 text-sm font-semibold text-[#0585FC] group-hover:text-[#0585FC]">
            Abrir
          </span>
        </Link>
      </section>
      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900">Sesión</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">Podés cerrar sesión del panel admin.</p>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          Volumen de actividad mensual
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          Partidos en tus canchas por mes: métrica de uso y rentabilidad operativa.
        </p>
        <div className="mt-6 flex flex-col gap-4">
          {growth.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">Sin datos aún.</p>
          ) : (
            growth.map((g) => (
              <div key={g.key} className="space-y-2">
                <div className="flex justify-between text-sm font-semibold text-slate-700">
                  <span className="text-slate-600">{g.label}</span>
                  <span className="tabular-nums text-slate-800">{g.count} partidos</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/60 ring-1 ring-slate-200/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0585FC]/90 via-[#0585FC]/85 to-[#0461C4]/75 shadow-sm"
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
