"use client";

import { useState } from "react";
import { saveClubHours } from "./actions";

const OPEN_OPTIONS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00",
];

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(min: number): string {
  const total = min % (24 * 60);
  if (total === 0 && min > 0) return "00:00";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type SlotOpt = { value: string; startStr: string; endStr: string };

function getCloseOptions(openTime: string): SlotOpt[] {
  const openMin = parseTime(openTime);
  const snapped = Math.ceil(openMin / 90) * 90;
  const opts: SlotOpt[] = [];
  for (let t = snapped; t + 90 <= 24 * 60; t += 90) {
    const endMin = t + 90;
    const startStr = formatTime(t);
    const endStr = endMin >= 24 * 60 ? "00:00" : formatTime(endMin);
    // value = end time stored in DB (00:00 = midnight handled server-side)
    opts.push({ value: endStr, startStr, endStr });
  }
  return opts;
}

function resolveOpen(stored: string): string {
  return OPEN_OPTIONS.includes(stored) ? stored : "09:00";
}

function resolveClose(storedClose: string, opts: SlotOpt[]): string {
  // Exact match against slot end times
  const direct = opts.find((o) => o.value === storedClose);
  if (direct) return direct.value;
  // "23:59" → map to midnight slot (00:00)
  if (storedClose >= "23:59" || storedClose === "00:00") {
    const midnight = opts.find((o) => o.value === "00:00");
    if (midnight) return "00:00";
  }
  // Default: latest slot available
  return opts[opts.length - 1]?.value ?? "00:00";
}

export default function ClubHoursForm({
  defaultOpen,
  defaultClose,
}: {
  defaultOpen: string;
  defaultClose: string;
}) {
  const initOpen = resolveOpen(defaultOpen);
  const initOpts = getCloseOptions(initOpen);
  const [openTime, setOpenTime] = useState(initOpen);
  const [closeVal, setCloseVal] = useState(() => resolveClose(defaultClose, initOpts));

  const closeOptions = getCloseOptions(openTime);

  function handleOpenChange(val: string) {
    setOpenTime(val);
    const newOpts = getCloseOptions(val);
    // Intentar mantener la misma hora de fin; si no existe, ir al máximo
    if (!newOpts.find((o) => o.value === closeVal)) {
      setCloseVal(newOpts[newOpts.length - 1]?.value ?? "00:00");
    }
  }

  return (
    <form action={saveClubHours} className="mt-4 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Hora de apertura
        <select
          name="open_time"
          value={openTime}
          onChange={(e) => handleOpenChange(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {OPEN_OPTIONS.map((t) => (
            <option key={t} value={t}>{t} hs</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Último turno del día
        </span>
        <select
          name="close_time"
          value={closeOptions.find((o) => o.value === closeVal) ? closeVal : (closeOptions[closeOptions.length - 1]?.value ?? "00:00")}
          onChange={(e) => setCloseVal(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {closeOptions.map((opt) => (
            <option key={opt.startStr} value={opt.value}>
              {opt.startStr} → {opt.endStr}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          El turno seleccionado es el último que se ofrece en el día.
        </p>
      </div>

      <button
        type="submit"
        className="self-start rounded-xl bg-[#0585FC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 sm:self-auto"
      >
        Guardar horarios
      </button>
    </form>
  );
}
