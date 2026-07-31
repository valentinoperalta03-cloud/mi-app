import Link from "next/link";
import { saveAvailabilityAction } from "@/app/superadmin/actions";
import CancelMeetingButton from "@/components/superadmin/cancel-meeting-button";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | "pending" | "confirmed" | "cancelled";

const filterTabs: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "cancelled", label: "Canceladas" },
];

const WEEKDAYS = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
] as const;

const statusBadge: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  confirmed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

type MeetingRow = {
  id: string;
  full_name: string;
  club_name: string;
  email: string;
  phone: string;
  meeting_date: string;
  meeting_time: string;
  status: string;
  meet_link: string | null;
};

type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

export default async function SuperadminReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; availability?: string }>;
}) {
  const { svc } = await requireSuperadminAction();
  const sp = await searchParams;
  const raw = String(sp.f ?? "all").toLowerCase();
  const filter: Filter = filterTabs.some((t) => t.key === raw) ? (raw as Filter) : "all";

  const { data: meetingsRaw } = await svc
    .from(DB_TABLES.meetings)
    .select("id,full_name,club_name,email,phone,meeting_date,meeting_time,status,meet_link")
    .order("meeting_date", { ascending: true })
    .order("meeting_time", { ascending: true });

  let meetings = (meetingsRaw ?? []) as MeetingRow[];
  if (filter !== "all") {
    meetings = meetings.filter((m) => m.status === filter);
  }

  const { data: availabilityRaw } = await svc
    .from(DB_TABLES.meetingAvailability)
    .select("day_of_week,start_time,end_time,slot_duration_minutes,is_active");
  const availability = (availabilityRaw ?? []) as AvailabilityRow[];
  const availabilityByDay = new Map(availability.map((a) => [a.day_of_week, a]));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Reuniones</h1>
        <p className="mt-1 text-sm text-slate-400">Videollamadas agendadas desde /agenda y disponibilidad horaria.</p>
      </header>

      {sp.availability === "saved" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Disponibilidad guardada correctamente.
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">Reuniones agendadas</h2>

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "all" ? "/superadmin/reuniones" : `/superadmin/reuniones?f=${t.key}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === t.key
                  ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Club</th>
                <th className="hidden px-4 py-3 md:table-cell">Email</th>
                <th className="hidden px-4 py-3 lg:table-cell">Teléfono</th>
                <th className="px-4 py-3">Estado</th>
                <th className="hidden px-4 py-3 md:table-cell">Meet</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No hay reuniones con este filtro.
                  </td>
                </tr>
              ) : (
                meetings.map((m) => (
                  <tr key={m.id} className="text-slate-200">
                    <td className="px-4 py-3">{new Date(`${m.meeting_date}T12:00:00`).toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3">{String(m.meeting_time).slice(0, 5)}</td>
                    <td className="px-4 py-3 font-medium text-white">{m.full_name}</td>
                    <td className="px-4 py-3">{m.club_name}</td>
                    <td className="hidden max-w-[180px] truncate px-4 py-3 text-slate-400 md:table-cell">{m.email}</td>
                    <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">{m.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge[m.status] ?? ""}`}>
                        {statusLabel[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {m.meet_link ? (
                        <a href={m.meet_link} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                          Link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.status !== "cancelled" ? <CancelMeetingButton meetingId={m.id} clubName={m.club_name} /> : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">Configurar disponibilidad</h2>
        <form action={saveAvailabilityAction} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          {WEEKDAYS.map((d) => {
            const existing = availabilityByDay.get(d.n);
            return (
              <div
                key={d.n}
                className="grid grid-cols-2 items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0 sm:grid-cols-[100px_auto_1fr_1fr_1fr]"
              >
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    name={`enabled_${d.n}`}
                    defaultChecked={Boolean(existing?.is_active)}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  {d.label}
                </label>
                <span className="hidden text-xs text-slate-500 sm:block">Desde</span>
                <input
                  type="time"
                  name={`start_${d.n}`}
                  defaultValue={existing?.start_time?.slice(0, 5) ?? "09:00"}
                  className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
                <input
                  type="time"
                  name={`end_${d.n}`}
                  defaultValue={existing?.end_time?.slice(0, 5) ?? "17:00"}
                  className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
                <select
                  name={`duration_${d.n}`}
                  defaultValue={String(existing?.slot_duration_minutes ?? 30)}
                  className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
            );
          })}
          <button
            type="submit"
            className="rounded-xl bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-500/40 hover:bg-cyan-500/30"
          >
            Guardar disponibilidad
          </button>
        </form>
      </section>
    </div>
  );
}
