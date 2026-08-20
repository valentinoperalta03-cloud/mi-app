"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { adminCard, adminKicker } from "@/components/admin/admin-premium";
import { getDashboardData, type DashboardDayData } from "./actions";
import TimelineGrid, { type TimelineCourt } from "./timeline-grid";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DashboardClient({
  todayYmd,
  courts,
  initialData,
}: {
  todayYmd: string;
  courts: TimelineCourt[];
  initialData: DashboardDayData;
}) {
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [data, setData] = useState<DashboardDayData>(initialData);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  async function changeDate(newDate: string) {
    setSelectedDate(newDate);
    setLoading(true);
    const newData = await getDashboardData(newDate);
    setData(newData);
    setLoading(false);
  }

  return (
    <section className={adminCard}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className={adminKicker}>Vista del día</p>
          <p className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Estado de tus canchas</p>
        </div>
        {selectedDate === todayYmd ? (
          <span className="rounded-full bg-[#0085FC]/10 px-3 py-1 text-xs font-bold text-[#0085FC]">Hoy</span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => changeDate(addDays(selectedDate, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] transition hover:bg-[var(--bg-subtle)]"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
        >
          <Calendar size={15} className="text-[#0085FC]" />
          {selectedDate === todayYmd ? "Hoy" : format(parseISO(selectedDate), "EEE d MMM", { locale: es })}
        </button>

        <button
          type="button"
          onClick={() => changeDate(addDays(selectedDate, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] transition hover:bg-[var(--bg-subtle)]"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {showCalendar ? (
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            changeDate(e.target.value);
            setShowCalendar(false);
          }}
          className="mt-3 w-full rounded-xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
          autoFocus
        />
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0085FC] border-t-transparent" />
          </div>
        ) : (
          <TimelineGrid courts={courts} openRangesByCourtId={data.openRangesByCourtId} events={data.events} />
        )}
      </div>
    </section>
  );
}
