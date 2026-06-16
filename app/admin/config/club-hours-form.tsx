"use client";

import { useState } from "react";
import { saveClubHours } from "./actions";

const OPEN_OPTIONS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00",
];

const CLOSE_OPTIONS = [
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30",
  "23:00", "23:30",
];

function closestValidOpen(val: string) {
  return OPEN_OPTIONS.includes(val) ? val : "09:00";
}
function closestValidClose(val: string, openTime: string) {
  const valid = CLOSE_OPTIONS.filter((t) => t > openTime);
  return valid.includes(val) ? val : (valid[valid.length - 1] ?? "22:30");
}

export default function ClubHoursForm({
  defaultOpen,
  defaultClose,
}: {
  defaultOpen: string;
  defaultClose: string;
}) {
  const [openTime, setOpenTime] = useState(() => closestValidOpen(defaultOpen));
  const [closeTime, setCloseTime] = useState(() =>
    closestValidClose(defaultClose, closestValidOpen(defaultOpen))
  );

  const validClose = CLOSE_OPTIONS.filter((t) => t > openTime);

  function handleOpenChange(val: string) {
    setOpenTime(val);
    const newValid = CLOSE_OPTIONS.filter((t) => t > val);
    if (!newValid.includes(closeTime)) {
      setCloseTime(newValid[newValid.length - 1] ?? "22:30");
    }
  }

  return (
    <form action={saveClubHours} className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
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

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Hora de cierre
        <select
          name="close_time"
          value={validClose.includes(closeTime) ? closeTime : (validClose[validClose.length - 1] ?? "22:30")}
          onChange={(e) => setCloseTime(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {validClose.map((t) => (
            <option key={t} value={t}>{t} hs · turnos de 90 min</option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-xl bg-[#0585FC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
      >
        Guardar horarios
      </button>
    </form>
  );
}
