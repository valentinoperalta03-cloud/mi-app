"use client";

import { useState } from "react";
import {
  CANCELLATION_POLICY_PRESETS,
  presetFromValue,
  resolveCancellationPresetValue,
} from "@/lib/admin/cancellation-policy-presets";
import { saveCancellationPolicy } from "./actions";

type Props = {
  initialPolicy: string;
  initialHours: number | null;
};

export default function ConfigCancellationForm({ initialPolicy, initialHours }: Props) {
  const defaultValue = resolveCancellationPresetValue(initialPolicy, initialHours);
  const [presetValue, setPresetValue] = useState(defaultValue);
  const preset = presetFromValue(presetValue);

  return (
    <form action={saveCancellationPolicy} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Política de cancelación</span>
        <select
          name="cancellation_preset"
          value={presetValue}
          onChange={(e) => setPresetValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {CANCELLATION_POLICY_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="cancellation_policy" value={preset.policy} />
      <input type="hidden" name="cancellation_hours" value={String(preset.hours)} />
      <p className="rounded-xl border border-slate-200 bg-transparent px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
        {preset.description}
      </p>
      <button
        type="submit"
        className="rounded-xl bg-[#0585FC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
      >
        Guardar política
      </button>
    </form>
  );
}
