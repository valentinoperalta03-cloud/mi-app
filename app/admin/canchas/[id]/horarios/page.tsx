import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import type { CourtScheduleRow } from "@/lib/database.types";
import { createClient } from "@/utils/supabase/server";
import { saveSchedules } from "../../actions";

const dayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type PageProps = {
  params: Promise<{ id: string }>;
};

function normalizeTime(t: string | null | undefined, fallback: string) {
  if (!t) return fallback;
  const s = String(t).trim();
  return s.length >= 5 ? s.slice(0, 5) : fallback;
}

export default async function AdminCanchaHorariosPage({ params }: PageProps) {
  const { id: courtId } = await params;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) {
    notFound();
  }

  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name")
    .eq("id", courtId)
    .maybeSingle();

  if (!court) notFound();

  const { data: schedData } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,open_time,close_time")
    .eq("court_id", courtId);

  const schedules = (schedData ?? []) as Pick<CourtScheduleRow, "day_of_week" | "open_time" | "close_time">[];
  const byDay = new Map(schedules.map((s) => [s.day_of_week, s]));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-sky-600`}>Horarios</p>
        <h1 className={adminTitle}>{court.name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Activá los días y definí apertura y cierre.</p>
      </header>

      <form action={saveSchedules} className={`${adminCard} space-y-5`}>
        <input type="hidden" name="court_id" value={courtId} />

        {dayLabels.map((label, d) => {
          const row = byDay.get(d);
          const active = Boolean(row?.open_time && row?.close_time);
          return (
            <div key={d} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" name={`day_${d}_active`} defaultChecked={active} className="h-4 w-4 rounded border-slate-300" />
                Activo
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Apertura</span>
                  <input
                    type="time"
                    name={`day_${d}_open`}
                    defaultValue={normalizeTime(row?.open_time ?? null, "08:00")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Cierre</span>
                  <input
                    type="time"
                    name={`day_${d}_close`}
                    defaultValue={normalizeTime(row?.close_time ?? null, "22:00")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
              </div>
            </div>
          );
        })}

        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Guardar horarios
        </button>
      </form>

      <Link
        href="/admin/canchas"
        className="inline-flex justify-center rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Volver a canchas
      </Link>
    </div>
  );
}
