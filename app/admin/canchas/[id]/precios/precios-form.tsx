"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { adminCard } from "@/components/admin/admin-premium";
import { saveCourtHourlyPrices, type RangeKey } from "./actions";

function buildTimeSlots(): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let h = 6; h < 24; h++) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  for (let h = 0; h <= 2; h++) {
    out.push(`${pad(h)}:00`);
    if (h < 2) out.push(`${pad(h)}:30`);
  }
  return out;
}

const TIME_SLOTS = buildTimeSlots();

const RANGE_META: Record<RangeKey, { title: string }> = {
  manana: { title: "Mañana" },
  tarde: { title: "Tarde" },
  noche: { title: "Noche" },
};

export type RangeFormInitial = {
  active: boolean;
  start: string;
  end: string;
  price: number;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar precios"}
    </button>
  );
}

type Props = {
  courtId: string;
  initial: Record<RangeKey, RangeFormInitial>;
};

export default function PreciosForm({ courtId, initial }: Props) {
  const keys = Object.keys(RANGE_META) as RangeKey[];

  return (
    <form action={saveCourtHourlyPrices} className="flex flex-col gap-4">
      <input type="hidden" name="court_id" value={courtId} />

      {keys.map((key) => {
        const meta = RANGE_META[key];
        const row = initial[key];
        return (
          <RangeCard
            key={key}
            rangeKey={key}
            title={meta.title}
            active={row.active}
            startDefault={row.start}
            endDefault={row.end}
            priceDefault={row.price}
          />
        );
      })}

      <SubmitButton />
    </form>
  );
}

function RangeCard({
  rangeKey,
  title,
  active,
  startDefault,
  endDefault,
  priceDefault,
}: {
  rangeKey: RangeKey;
  title: string;
  active: boolean;
  startDefault: string;
  endDefault: string;
  priceDefault: number;
}) {
  const [on, setOn] = useState(active);

  return (
    <div
      className={`${adminCard} space-y-4 p-5 transition-opacity ${
        on ? "" : "opacity-50 grayscale"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {on ? <input type="hidden" name={`${rangeKey}_on`} value="on" /> : null}
          <span className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Hora inicio
          <select
            name={`${rangeKey}_start`}
            defaultValue={startDefault}
            disabled={!on}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {TIME_SLOTS.map((t) => (
              <option key={`${rangeKey}-s-${t}`} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Hora fin
          <select
            name={`${rangeKey}_end`}
            defaultValue={endDefault}
            disabled={!on}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {TIME_SLOTS.map((t) => (
              <option key={`${rangeKey}-e-${t}`} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Precio (ARS)
          <input
            type="number"
            name={`${rangeKey}_price`}
            min={0}
            step="1"
            defaultValue={priceDefault}
            disabled={!on}
            className="rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>
    </div>
  );
}
