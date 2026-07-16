"use client";

import { useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
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
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Política de cancelación</span>
        <select
          name="cancellation_preset"
          value={presetValue}
          onChange={(e) => setPresetValue(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
      <p className="rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm text-[var(--text-secondary)]">
        {preset.description}
      </p>
      <button type="submit" className={adminCTAPrimary}>
        Guardar política
      </button>
    </form>
  );
}
