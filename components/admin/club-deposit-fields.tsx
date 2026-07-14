"use client";

import { useState } from "react";
import { calculateDepositAmount } from "@/lib/deposit-utils";

const EXAMPLE_TOTAL = 10000;

export default function ClubDepositFields({
  defaultDepositType,
  defaultDepositValue,
}: {
  defaultDepositType: "percentage" | "fixed" | null;
  defaultDepositValue: number;
}) {
  const [type, setType] = useState<"percentage" | "fixed">(defaultDepositType ?? "fixed");
  const [value, setValue] = useState(defaultDepositValue > 0 ? String(defaultDepositValue) : "");

  const numericValue = Number(value);
  const validValue =
    value.trim() !== "" &&
    Number.isFinite(numericValue) &&
    (type === "percentage" ? numericValue >= 1 && numericValue <= 100 : numericValue > 0);

  const depositAmount = validValue ? calculateDepositAmount(EXAMPLE_TOTAL, type, numericValue) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-700 dark:text-slate-200">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deposit_type"
            value="fixed"
            checked={type === "fixed"}
            onChange={() => setType("fixed")}
          />
          Monto fijo (ARS)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="deposit_type"
            value="percentage"
            checked={type === "percentage"}
            onChange={() => setType("percentage")}
          />
          Porcentaje del total (%)
        </label>
      </div>
      <input
        name="deposit_value"
        type="number"
        min={1}
        max={type === "percentage" ? 100 : undefined}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === "percentage" ? "Ej. 30" : "Ej. 3000"}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <p className="rounded-xl bg-[#0585FC]/5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        {validValue
          ? `Para una cancha de $${EXAMPLE_TOTAL.toLocaleString("es-AR")}, la seña sería $${depositAmount.toLocaleString("es-AR")}.`
          : type === "percentage"
            ? "Ingresá un porcentaje entre 1 y 100."
            : "Ingresá un monto mayor a 0."}
      </p>
    </div>
  );
}
