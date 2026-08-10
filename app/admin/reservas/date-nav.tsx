"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

function shiftDate(ymd: string, days: number): string {
  const d = parseISO(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const arrowClass =
  "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-[var(--text-secondary)] " +
  "transition-colors duration-200 hover:bg-[rgba(0,133,252,0.10)]";

export default function DateNav({ selectedDate }: { selectedDate: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function goTo(ymd: string) {
    router.push(`/admin/reservas?date=${ymd}`);
  }

  const label = format(parseISO(`${selectedDate}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });
  const labelCap = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => goTo(shiftDate(selectedDate, -1))}
        aria-label="Día anterior"
        className={arrowClass}
        style={{ borderRadius: 8 }}
      >
        <ChevronLeft size={20} />
      </button>

      <button
        type="button"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          if ("showPicker" in el && typeof el.showPicker === "function") el.showPicker();
          else el.click();
        }}
        className="min-w-[200px] cursor-pointer px-4 py-2 text-center text-base font-semibold capitalize text-[var(--text-primary)] transition-colors duration-200 hover:bg-[rgba(0,133,252,0.10)]"
        style={{ borderRadius: 8 }}
      >
        {labelCap}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={selectedDate}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => goTo(shiftDate(selectedDate, 1))}
        aria-label="Día siguiente"
        className={arrowClass}
        style={{ borderRadius: 8 }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
