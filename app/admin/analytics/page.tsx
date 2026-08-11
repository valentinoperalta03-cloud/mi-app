import { format, subDays } from "date-fns";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminAccentBar, adminCard, adminKicker, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const SLOT_MINUTES = 90;
const SLOT_LABELS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00", "22:30"];
const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function toMinutes(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.slice(0, 5).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

function slotKeyFromTime(value: string | null): string {
  const parsed = toMinutes(String(value ?? "").trim());
  if (parsed < 0) return SLOT_LABELS[0];
  let closest = SLOT_LABELS[0];
  let minDiff = Number.POSITIVE_INFINITY;
  for (const slot of SLOT_LABELS) {
    const diff = Math.abs(toMinutes(slot) - parsed);
    if (diff < minDiff) {
      minDiff = diff;
      closest = slot;
    }
  }
  return closest;
}

function mondayFirstIndex(ymd: string | null): number | null {
  if (!ymd) return null;
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const jsDay = d.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const now = new Date();
  const since30 = subDays(now, 30);
  const since30Ymd = format(since30, "yyyy-MM-dd");

  const mainClubId = ctx.clubIds[0] ?? "";

  const [{ data: matchesRaw }, { data: participantsRaw }, { data: timeRangesRaw }, { data: clubRow }] =
    await Promise.all([
      ctx.courtIds.length > 0
        ? supabase
            .from(DB_TABLES.matches)
            .select("id,court_id,owner_id,scheduled_date,scheduled_time,match_status")
            .in("court_id", ctx.courtIds)
            .gte("scheduled_date", since30Ymd)
            .neq("match_status", "cancelled")
        : { data: [] },
      ctx.courtIds.length > 0
        ? supabase
            .from(DB_TABLES.matchParticipants)
            .select("match_id,player_id,matches!inner(court_id,scheduled_date)")
            .in("matches.court_id", ctx.courtIds)
            .gte("matches.scheduled_date", since30Ymd)
        : { data: [] },
      // Franjas horarias propias por cancha — court_time_ranges es la única
      // fuente de horarios ahora (reemplaza court_schedules rama día-de-semana).
      ctx.courtIds.length > 0
        ? supabase
            .from(DB_TABLES.courtTimeRanges)
            .select("court_id,day_of_week,open_time,close_time")
            .in("court_id", ctx.courtIds)
        : { data: [] },
      mainClubId
        ? supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", mainClubId).maybeSingle()
        : { data: null },
    ]);

  const matches = (matchesRaw ?? []) as Array<{
    id: string;
    court_id: string;
    owner_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    match_status: string | null;
  }>;
  const participants = (participantsRaw ?? []) as Array<{
    match_id: string;
    player_id: string;
    matches: { court_id: string; scheduled_date: string | null } | { court_id: string; scheduled_date: string | null }[] | null;
  }>;
  const timeRanges = (timeRangesRaw ?? []) as Array<{
    court_id: string;
    day_of_week: number | null;
    open_time: string | null;
    close_time: string | null;
  }>;
  const clubBounds = clubRow as { open_time: string | null; close_time: string | null } | null;
  const clubOpenMin = clubBounds?.open_time ? toMinutes(String(clubBounds.open_time).slice(0, 5)) : -1;
  const clubCloseMin = clubBounds?.close_time ? toMinutes(String(clubBounds.close_time).slice(0, 5)) : -1;

  const participantCountByMatch = new Map<string, number>();
  for (const row of participants) {
    participantCountByMatch.set(row.match_id, (participantCountByMatch.get(row.match_id) ?? 0) + 1);
  }

  const totalReservations = matches.length;

  // Una cancha puede tener varias franjas no contiguas el mismo día — se
  // agrupan todas por court+día para sumar sus slots (no se pisan entre sí
  // porque /admin/canchas/[id]/horarios ya valida que no se solapen).
  const rangesByCourtDay = new Map<string, Array<{ open: number; close: number }>>();
  for (const r of timeRanges) {
    if (r.day_of_week == null || !r.open_time || !r.close_time) continue;
    const key = `${r.court_id}__${r.day_of_week}`;
    const list = rangesByCourtDay.get(key) ?? [];
    list.push({ open: toMinutes(String(r.open_time).slice(0, 5)), close: toMinutes(String(r.close_time).slice(0, 5)) });
    rangesByCourtDay.set(key, list);
  }

  /** Slots de 90min para una cancha en un día: sus franjas propias, o el horario del club si no tiene franjas ese día. */
  function slotsForCourtDay(courtId: string, jsDay: number): number {
    const ranges = rangesByCourtDay.get(`${courtId}__${jsDay}`);
    const effectiveRanges =
      ranges && ranges.length > 0
        ? ranges
        : clubOpenMin >= 0 && clubCloseMin > clubOpenMin
          ? [{ open: clubOpenMin, close: clubCloseMin }]
          : [];
    let total = 0;
    for (const r of effectiveRanges) {
      if (r.close <= r.open) continue;
      total += Math.floor((r.close - r.open) / SLOT_MINUTES);
    }
    return total;
  }

  let totalAvailableSlots = 0;
  for (let i = 0; i < 30; i++) {
    const day = subDays(now, i);
    const jsDay = day.getDay();
    for (const court of ctx.courts) {
      totalAvailableSlots += slotsForCourtDay(court.id, jsDay);
    }
  }
  const globalOccupancy = totalAvailableSlots > 0 ? Math.round((totalReservations / totalAvailableSlots) * 100) : 0;

  const totalParticipants = matches.reduce((acc, m) => acc + (participantCountByMatch.get(m.id) ?? 0), 0);
  const avgPlayers = totalReservations > 0 ? totalParticipants / totalReservations : 0;

  const slotCounts = new Map<string, number>(SLOT_LABELS.map((s) => [s, 0]));
  for (const m of matches) {
    const slot = slotKeyFromTime(m.scheduled_time);
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  }
  const busiestSlot = [...slotCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [SLOT_LABELS[0], 0];
  const maxSlotCount = Math.max(1, ...SLOT_LABELS.map((s) => slotCounts.get(s) ?? 0));

  const dayCounts = new Array(7).fill(0);
  for (const m of matches) {
    const idx = mondayFirstIndex(m.scheduled_date);
    if (idx == null) continue;
    dayCounts[idx] += 1;
  }
  const maxDayCount = Math.max(1, ...dayCounts);
  const minDayCount = Math.min(...dayCounts);
  const busiestDayIdx = dayCounts.findIndex((c) => c === maxDayCount);
  const quietestDayIdx = dayCounts.findIndex((c) => c === minDayCount);

  const reservationsByCourt = new Map<string, number>();
  const completeByCourt = new Map<string, number>();
  const incompleteByCourt = new Map<string, number>();
  for (const m of matches) {
    reservationsByCourt.set(m.court_id, (reservationsByCourt.get(m.court_id) ?? 0) + 1);
    const count = participantCountByMatch.get(m.id) ?? 0;
    if (count >= 4) {
      completeByCourt.set(m.court_id, (completeByCourt.get(m.court_id) ?? 0) + 1);
    } else {
      incompleteByCourt.set(m.court_id, (incompleteByCourt.get(m.court_id) ?? 0) + 1);
    }
  }
  const availableSlotsByCourt = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const day = subDays(now, i);
    const jsDay = day.getDay();
    for (const court of ctx.courts) {
      const slots = slotsForCourtDay(court.id, jsDay);
      if (slots > 0) availableSlotsByCourt.set(court.id, (availableSlotsByCourt.get(court.id) ?? 0) + slots);
    }
  }

  const weekBuckets = [0, 0, 0, 0];
  for (const m of matches) {
    if (!m.scheduled_date) continue;
    const diffDays = Math.floor((now.getTime() - new Date(`${m.scheduled_date}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 29) continue;
    const idx = 3 - Math.floor(diffDays / 7);
    if (idx >= 0 && idx < 4) weekBuckets[idx] += 1;
  }
  const maxWeek = Math.max(1, ...weekBuckets);
  const weekDelta = weekBuckets[3] - weekBuckets[2];

  const playerVisits = new Map<string, Set<string>>();
  for (const m of matches) {
    if (!m.owner_id) continue;
    const set = playerVisits.get(m.owner_id) ?? new Set<string>();
    set.add(m.id);
    playerVisits.set(m.owner_id, set);
  }
  for (const p of participants) {
    const set = playerVisits.get(p.player_id) ?? new Set<string>();
    set.add(p.match_id);
    playerVisits.set(p.player_id, set);
  }
  let oneTimePlayers = 0;
  let recurrentPlayers = 0;
  for (const visits of playerVisits.values()) {
    if (visits.size <= 1) oneTimePlayers += 1;
    else recurrentPlayers += 1;
  }

  const deadSlots = [...slotCounts.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <AdminPageHeader
        kicker="Análisis"
        title="Uso y ocupación del club"
        subtitle="Estadísticas de los últimos 30 días"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${adminCard} ${adminAccentBar}`}>
          <p className={adminKicker}>Tasa de ocupación global</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{globalOccupancy}%</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {totalReservations} reservas / {totalAvailableSlots} slots
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div className="h-full rounded-full bg-[#0085FC]" style={{ width: `${Math.max(2, globalOccupancy)}%` }} />
          </div>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Partido promedio</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{avgPlayers.toFixed(1)}/4</p>
          <p className="text-xs text-[var(--text-tertiary)]">jugadores promedio</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Horario más demandado</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{busiestSlot[0]}hs</p>
          <p className="text-xs text-[var(--text-tertiary)]">{busiestSlot[1]} reservas</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Día más ocupado</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {busiestDayIdx >= 0 ? WEEKDAY_LABELS[busiestDayIdx] : "Sin datos"}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {busiestDayIdx >= 0 ? `${dayCounts[busiestDayIdx]} reservas` : "Sin reservas"}
          </p>
        </div>
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Detalle</p>
        <h2 className={adminTitle}>Ocupación por hora (30 días)</h2>
        <div className="mt-4 space-y-2">
          {SLOT_LABELS.map((slot) => {
            const count = slotCounts.get(slot) ?? 0;
            const isTop = slot === busiestSlot[0];
            return (
              <div key={slot} className="grid grid-cols-[56px_1fr_40px] items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--text-secondary)]">{slot}</span>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className={`h-full rounded-full ${isTop ? "bg-[#0461C4]" : "bg-[#7CC0FF]"}`}
                    style={{ width: `${Math.max(3, (count / maxSlotCount) * 100)}%` }}
                  />
                </div>
                <span className="text-right font-bold text-[var(--text-secondary)]">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Detalle</p>
        <h2 className={adminTitle}>Ocupación por día de semana</h2>
        <div className="mt-4 space-y-2">
          {WEEKDAY_LABELS.map((day, idx) => {
            const count = dayCounts[idx];
            const isMax = idx === busiestDayIdx;
            const isMin = idx === quietestDayIdx;
            return (
              <div key={day} className="grid grid-cols-[70px_1fr_36px] items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--text-secondary)]">{day.slice(0, 3)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className={`h-full rounded-full ${
                      isMax ? "bg-[#0085FC]" : isMin ? "bg-rose-300 dark:bg-rose-700" : "bg-[#7CC0FF]"
                    }`}
                    style={{ width: `${Math.max(3, (count / maxDayCount) * 100)}%` }}
                  />
                </div>
                <span className="text-right font-bold text-[var(--text-secondary)]">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Detalle</p>
        <h2 className={adminTitle}>Tasa de ocupación por cancha</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {ctx.courts.map((court) => {
            const reservations = reservationsByCourt.get(court.id) ?? 0;
            const slots = availableSlotsByCourt.get(court.id) ?? 0;
            const ratio = slots > 0 ? Math.round((reservations / slots) * 100) : 0;
            const completos = completeByCourt.get(court.id) ?? 0;
            const incompletos = incompleteByCourt.get(court.id) ?? 0;
            return (
              <li key={court.id} className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-secondary)]">{court.name ?? "Cancha"}</span>
                  <span className="font-bold text-[var(--text-primary)]">{ratio}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className="h-full rounded-full bg-[#0085FC]" style={{ width: `${Math.max(2, ratio)}%` }} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {reservations} reservas / {slots} slots disponibles
                </p>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {completos} partidos completos · {incompletos} incompletos
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Tendencia</p>
        <h2 className={adminTitle}>Tendencia semanal (últimas 4 semanas)</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {weekBuckets.map((value, idx) => (
            <div key={idx} className="rounded-xl border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">Semana {idx + 1}</p>
              <div className="mt-2 flex h-24 items-end justify-center">
                <div
                  className="w-10 rounded-t-md bg-[#0085FC]"
                  style={{ height: `${Math.max(8, (value / maxWeek) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{value} reservas</p>
            </div>
          ))}
        </div>
        <p
          className={`mt-3 text-sm font-semibold ${
            weekDelta > 0 ? "text-emerald-600" : weekDelta < 0 ? "text-rose-600" : "text-[var(--text-tertiary)]"
          }`}
        >
          {weekDelta > 0 ? `↑ Esta semana va +${weekDelta} vs la anterior` : null}
          {weekDelta < 0 ? `↓ Esta semana va ${Math.abs(weekDelta)} menos vs la anterior` : null}
          {weekDelta === 0 ? "→ Esta semana está igual que la anterior" : null}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className={adminCard}>
          <p className={adminKicker}>Jugadores</p>
          <h2 className={adminTitle}>Jugadores únicos vs recurrentes</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">1 sola vez</p>
              <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">{oneTimePlayers}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] p-3 text-center">
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">2+ veces</p>
              <p className="mt-1 text-3xl font-bold text-[var(--text-primary)]">{recurrentPlayers}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-100 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="font-admin-display text-base font-bold text-amber-900 dark:text-amber-300">
            💡 Horarios con baja ocupación — considerá promociones
          </h2>
          <ul className="mt-3 space-y-1 text-sm font-medium text-amber-800 dark:text-amber-200">
            {deadSlots.map(([slot, count]) => (
              <li key={slot}>
                {slot}hs → {count} reservas en 30 días
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
