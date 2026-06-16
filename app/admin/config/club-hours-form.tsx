"use client";

import { saveClubHours } from "./actions";

const OPEN_OPTIONS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00",
];

export default function ClubHoursForm({ defaultOpen }: { defaultOpen: string }) {
  const current = OPEN_OPTIONS.includes(defaultOpen) ? defaultOpen : "09:00";

  return (
    <form action={saveClubHours} className="mt-4 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Hora de apertura
        <select
          name="open_time"
          defaultValue={current}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {OPEN_OPTIONS.map((t) => (
            <option key={t} value={t}>{t} hs</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          El sistema genera turnos de 90 min hasta el último que llega a las 00:00.
        </p>
      </label>

      <button
        type="submit"
        className="self-start rounded-xl bg-[#0585FC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 sm:self-auto"
      >
        Guardar horarios
      </button>
    </form>
  );
}
