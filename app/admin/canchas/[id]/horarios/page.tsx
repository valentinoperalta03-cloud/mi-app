import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import type { CourtScheduleRow } from "@/lib/database.types";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import { saveCourtHourlyPrices } from "../precios/actions";
import { saveSchedules } from "./actions";

const dayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function buildCourtTurns(openTime: string, closeTime: string, durationMin: number) {
  const rawOpen = parseClockToMinutes(openTime || "09:00");
  const rawClose = parseClockToMinutes(closeTime || "23:59");
  // Misma lógica que buildGrid: snap al múltiplo de durationMin
  const open = Math.ceil(rawOpen / durationMin) * durationMin;
  // 23:59 y 00:00 = medianoche
  const close = rawClose === 0 || rawClose >= 23 * 60 + 59 ? 24 * 60 : rawClose;
  const turns: { start: string; end: string }[] = [];
  for (let t = open; t + durationMin <= close; t += durationMin) {
    turns.push({ start: minutesToClock(t), end: minutesToClock(t + durationMin) });
  }
  return turns;
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string; price_error?: string; price_saved?: string }>;
};

function normalizeTime(t: string | null | undefined, fallback: string) {
  if (!t) return fallback;
  const s = String(t).trim();
  return s.length >= 5 ? s.slice(0, 5) : fallback;
}

function decodeErr(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export default async function AdminCanchaHorariosPage({ params, searchParams }: PageProps) {
  const { id: courtId } = await params;
  const sp = searchParams ? await searchParams : {};
  const horariosError = sp.error?.trim() ?? "";
  const horariosSaved = sp.saved === "1";
  const preciosError = sp.price_error?.trim() ?? "";
  const preciosSaved = sp.price_saved === "1";

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) notFound();

  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,price,club_id,slot_duration_minutes")
    .eq("id", courtId)
    .maybeSingle();
  if (!court) notFound();

  const clubIdForCourt = String((court as { club_id?: string | null }).club_id ?? "").trim();
  const { data: clubHours } = clubIdForCourt
    ? await supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", clubIdForCourt).maybeSingle()
    : { data: null };
  const clubOpen = String((clubHours as { open_time?: string | null } | null)?.open_time ?? "").trim().slice(0, 5);
  const clubClose = String((clubHours as { close_time?: string | null } | null)?.close_time ?? "").trim().slice(0, 5);

  const { data: schedData } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,open_time,close_time")
    .eq("court_id", courtId);
  const schedules = (schedData ?? []) as Pick<CourtScheduleRow, "day_of_week" | "open_time" | "close_time">[];
  const byDay = new Map(schedules.map((s) => [s.day_of_week, s]));

  const { data: slotRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,price_override")
    .eq("court_id", courtId)
    .is("day_of_week", null)
    .not("start_time", "is", null);
  const byTurnStart = new Map(
    ((slotRows ?? []) as Array<{ start_time: string | null; price_override: number | null }>)
      .filter((r) => r.start_time)
      .map((r) => [String(r.start_time).slice(0, 5), Number(r.price_override ?? 0)])
  );
  const basePrice = Number((court as { price: number | null }).price ?? 0);
  const slotDuration = Number((court as { slot_duration_minutes?: number | null }).slot_duration_minutes ?? 90);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />
      {clubOpen && clubClose ? (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          Horario del club: {clubOpen} a {clubClose}. Los horarios por cancha abajo son opcionales (p. ej. cancha techada con cierre distinto).
        </div>
      ) : null}
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Horarios y precios</p>
        <h1 className={adminTitle}>{court.name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Configurá la disponibilidad y precios de la cancha en una sola vista.</p>
      </header>

      <section className={`${adminCard} space-y-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Horarios de atención</h2>
          <p className="text-sm text-slate-500">Activá los días y definí apertura y cierre.</p>
        </div>
        {horariosSaved ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-800">
            Horarios guardados correctamente.
          </div>
        ) : null}
        {horariosError ? (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
            {decodeErr(horariosError)}
          </div>
        ) : null}

        <form action={saveSchedules} className="space-y-5">
          <input type="hidden" name="court_id" value={courtId} />

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2">
            <p className="text-sm font-bold text-slate-900">Duración de turno</p>
            <p className="text-xs text-slate-500">Define cada cuánto tiempo se generan los slots de reserva.</p>
            <select
              name="slot_duration_minutes"
              defaultValue={String(slotDuration)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            >
              <option value="60">60 minutos (1 hora)</option>
              <option value="90">90 minutos (1 hora 30 min)</option>
              <option value="120">120 minutos (2 horas)</option>
            </select>
          </div>

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
                      defaultValue={normalizeTime(row?.open_time ?? null, "09:00")}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Cierre</span>
                    <input
                      type="time"
                      name={`day_${d}_close`}
                      defaultValue={normalizeTime(row?.close_time ?? null, "23:59")}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
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
      </section>

      <section className={`${adminCard} space-y-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Precios por turno</h2>
          <p className="text-sm text-slate-500">Configurá el precio de cada turno de 1h30.</p>
        </div>
        {preciosSaved ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-800">
            Precios guardados correctamente.
          </div>
        ) : null}
        {preciosError ? (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
            {decodeErr(preciosError)}
          </div>
        ) : null}

        <form action={saveCourtHourlyPrices} className="space-y-4">
          <input type="hidden" name="court_id" value={courtId} />
          <input type="hidden" name="slot_duration_minutes" value={slotDuration} />
          {buildCourtTurns(clubOpen || "09:00", clubClose || "23:59", slotDuration).map((turn) => (
            <label key={`${turn.start}-${turn.end}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">
                {turn.start} - {turn.end}
              </span>
              <input
                type="number"
                min={0}
                step="1"
                name={`price_${turn.start}`}
                defaultValue={byTurnStart.get(turn.start) ?? basePrice}
                className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
              />
            </label>
          ))}
          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Guardar precios
          </button>
        </form>
      </section>
    </div>
  );
}
