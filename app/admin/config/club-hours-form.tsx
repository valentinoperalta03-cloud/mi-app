"use client";

import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveClubHours } from "./actions";

const OPEN_OPTIONS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00",
];

export default function ClubHoursForm({ defaultOpen }: { defaultOpen: string }) {
  const current = OPEN_OPTIONS.includes(defaultOpen) ? defaultOpen : "09:00";

  return (
    <form action={saveClubHours} className="mt-4 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-secondary)]">
        Hora de apertura
        <select
          name="open_time"
          defaultValue={current}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          {OPEN_OPTIONS.map((t) => (
            <option key={t} value={t}>{t} hs</option>
          ))}
        </select>
        <p className="text-xs text-[var(--text-tertiary)]">
          El sistema genera turnos de 90 min hasta el último que llega a las 00:00.
        </p>
      </label>

      <button type="submit" className={`self-start sm:self-auto ${adminCTAPrimary}`}>
        Guardar horarios
      </button>
    </form>
  );
}
