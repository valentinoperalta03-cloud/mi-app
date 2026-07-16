"use client";

import { useState } from "react";
import { Lock, X } from "lucide-react";
import { adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { updateFinancePin } from "./actions";

type Props = {
  hasFinancePin: boolean;
  pinOk: boolean;
  pinErr: string;
};

export default function FinancePinModal({ hasFinancePin, pinOk, pinErr }: Props) {
  const [open, setOpen] = useState(pinOk || Boolean(pinErr));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
      >
        🔒 Cambiar PIN de seguridad
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-admin-display flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                <Lock size={18} />
                PIN de finanzas
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              {hasFinancePin
                ? "Protegé el módulo financiero con un PIN de 4 a 6 dígitos."
                : "Creá un PIN de 4 a 6 dígitos para acceder a finanzas."}
            </p>
            {pinOk ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                Cambios guardados correctamente.
              </p>
            ) : null}
            {pinErr ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                {pinErr}
              </p>
            ) : null}
            <form action={updateFinancePin} className="mt-4 grid gap-3 sm:grid-cols-2">
              {hasFinancePin ? (
                <label className="sm:col-span-2">
                  <span className={adminKicker}>PIN actual</span>
                  <input
                    name="current_pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{4,6}"
                    required
                    className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
              <label>
                <span className={adminKicker}>
                  {hasFinancePin ? "Nuevo PIN" : "PIN"}
                </span>
                <input
                  name="new_pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{4,6}"
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className={adminKicker}>Confirmar PIN</span>
                <input
                  name="confirm_pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{4,6}"
                  required
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={adminCTAPrimary}>
                  {hasFinancePin ? "Cambiar PIN" : "Crear PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
