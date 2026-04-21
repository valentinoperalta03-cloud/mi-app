import Image from "next/image";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { PaymentStatusPill, PlayerAvatar } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type CourtEmbed = { id: string; name: string | null };
type MatchRow = {
  id: string;
  date: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  court_id: string;
  owner_id: string | null;
  payment_status: string | null;
  total_price: number | null;
  match_status: string | null;
  location_name: string | null;
  courts: CourtEmbed | null;
};

type PageProps = {
  searchParams: Promise<{ date?: string; selected?: string }>;
};

function getTimeFromMatch(m: MatchRow): string {
  if (m.scheduled_time) return String(m.scheduled_time).trim().slice(0, 5);
  try {
    return format(parseISO(m.date), "HH:mm");
  } catch {
    return "--:--";
  }
}

function getHourBucket(m: MatchRow): string {
  const hour = Number(getTimeFromMatch(m).slice(0, 2));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "00:00";
  return `${String(hour).padStart(2, "0")}:00`;
}

function durationMin(m: MatchRow): number {
  return m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
}

function buildHours() {
  return Array.from({ length: 16 }, (_, idx) => `${String(idx + 8).padStart(2, "0")}:00`);
}

export default async function AdminReservasPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90`}>
        <AdminBackLink />
        <p className="mt-4 text-sm font-semibold text-slate-800">Sin club asignado.</p>
      </div>
    );
  }

  const selectedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : getTodayYmdInArgentina();
  const selectedMatchId = sp.selected?.trim() ?? "";

  const { data: matchesRaw, error: matchesError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,scheduled_date,scheduled_time,duration_minutes,court_id,owner_id,payment_status,total_price,match_status,location_name,courts(id,name)"
    )
    .in("court_id", ctx.courtIds)
    .eq("scheduled_date", selectedDate)
    .eq("match_type", "reservation")
    .neq("match_status", "cancelled")
    .order("scheduled_time", { ascending: true });

  const matches = (matchesRaw ?? []) as unknown as MatchRow[];
  const creatorIds = Array.from(new Set(matches.map((m) => m.owner_id).filter(Boolean))) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const nameByUser = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])
  );

  const slotMap = new Map<string, MatchRow>();
  for (const m of matches) {
    const key = `${m.court_id}__${getHourBucket(m)}`;
    if (!slotMap.has(key)) slotMap.set(key, m);
  }

  const selectedMatch = selectedMatchId ? matches.find((m) => m.id === selectedMatchId) ?? null : null;
  const hours = buildHours();
  const titleDate = format(parseISO(`${selectedDate}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />

      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#0585FC]/10/60 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className={`${adminKicker} text-[#0585FC]`}>Agenda diaria</p>
            <h1 className={adminTitle}>Gestión de reservas</h1>
            <p className={adminSubtitle}>Vista calendario por canchas para operar el día sin fricción.</p>
          </div>
          <div className="relative h-14 w-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90">
            <Image src="/logo-marca.png" alt="Logo de Padelibre" fill className="object-contain p-2 opacity-85" />
          </div>
        </div>
      </header>

      <section className={`${adminCard} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
        <div>
          <p className={adminKicker}>Fecha seleccionada</p>
          <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{titleDate}</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none ring-[#0585FC]/20 transition focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ver día
          </button>
        </form>
      </section>

      {matchesError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm font-medium text-rose-800 shadow-sm">
          Error al cargar reservas: {matchesError.message}.
        </div>
      ) : (
        <section className={`${adminCard} overflow-hidden p-0`}>
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div
                className="grid border-b border-slate-200/80 bg-slate-50/80"
                style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(160px, 1fr))` }}
              >
                <div className="sticky left-0 z-20 border-r border-slate-200/80 bg-slate-50/95 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hora
                </div>
                {ctx.courts.map((court) => (
                  <div key={court.id} className="border-r border-slate-200/70 px-3 py-3 text-sm font-semibold text-slate-700">
                    {court.name ?? "Cancha"}
                  </div>
                ))}
              </div>

              {hours.map((hour) => (
                <div
                  key={hour}
                  className="grid border-b border-slate-100/90"
                  style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(160px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 border-r border-slate-200/70 bg-white px-3 py-4 text-xs font-semibold text-slate-500">
                    {hour}
                  </div>
                  {ctx.courts.map((court) => {
                    const slotKey = `${court.id}__${hour}`;
                    const reservation = slotMap.get(slotKey);
                    if (!reservation) {
                      return (
                        <div key={slotKey} className="min-h-16 border-r border-slate-100/90 bg-slate-50/70 px-2 py-2">
                          <div className="h-full rounded-xl border border-dashed border-slate-200/80 bg-slate-100/60" />
                        </div>
                      );
                    }
                    const player = reservation.owner_id ? nameByUser.get(reservation.owner_id) ?? "Jugador" : "Sin asignar";
                    return (
                      <Link
                        key={slotKey}
                        href={`/admin/reservas?date=${selectedDate}&selected=${reservation.id}`}
                        className="block min-h-16 border-r border-slate-100/90 bg-[#0585FC]/5/50 px-2 py-2 transition-all duration-200 hover:bg-[#0585FC]/10/60"
                      >
                        <div className="rounded-xl border border-[#0585FC]/20/80 bg-[#0585FC]/50 px-3 py-2 text-white shadow-sm">
                          <p className="truncate text-sm font-semibold">{player}</p>
                          <p className="text-xs opacity-90">{getTimeFromMatch(reservation)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedMatch ? (
        <section className={`${adminCard} border-[#0585FC]/20/80 bg-[#0585FC]/5/40`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar
                name={selectedMatch.owner_id ? nameByUser.get(selectedMatch.owner_id) ?? "Jugador" : "Sin asignar"}
              />
              <div>
                <p className={adminKicker}>Detalle de reserva</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedMatch.owner_id ? nameByUser.get(selectedMatch.owner_id) ?? "Jugador" : "Sin asignar"}
                </h2>
              </div>
            </div>
            <PaymentStatusPill status={String(selectedMatch.payment_status ?? "—")} />
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
              <dt className={adminKicker}>Cancha</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {selectedMatch.courts?.name ?? ctx.courts.find((c) => c.id === selectedMatch.court_id)?.name ?? "Cancha"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
              <dt className={adminKicker}>Horario</dt>
              <dd className="mt-1 font-semibold text-slate-800">{getTimeFromMatch(selectedMatch)}</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
              <dt className={adminKicker}>Duración</dt>
              <dd className="mt-1 font-semibold text-slate-800">{durationMin(selectedMatch)} min</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2">
              <dt className={adminKicker}>Monto</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {selectedMatch.total_price != null ? `$${Number(selectedMatch.total_price).toFixed(2)}` : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <Link
              href={`/admin/reservas?date=${selectedDate}`}
              className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cerrar detalle
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
