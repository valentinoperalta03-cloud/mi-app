"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle } from "lucide-react";
import {
  adminBadgeLima,
  adminBadgePending,
  adminCTAPrimary,
  adminPressable,
} from "@/components/admin/admin-premium";
import { savePaymentMethods } from "./actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]";

type Props = {
  isMpConnected: boolean;
  mpUserId: string | null;
  initial: {
    accepts_cash: boolean;
    accepts_transfer: boolean;
    bank_alias: string;
    bank_cbu: string;
  };
};

export default function ConfigPaymentMethodsForm({ isMpConnected, mpUserId, initial }: Props) {
  return (
    <form action={savePaymentMethods} className="space-y-4">
      <Link
        href="/admin/config/mp-connect"
        className={`block rounded-2xl border p-5 transition ${adminPressable} ${
          isMpConnected
            ? "border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30"
            : "border-amber-200 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {isMpConnected ? (
            <CheckCircle size={18} className="text-emerald-600" />
          ) : (
            <AlertCircle size={18} className="text-amber-600" />
          )}
          <p
            className={`text-sm font-semibold ${isMpConnected ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
          >
            Mercado Pago
          </p>
          <span className={isMpConnected ? adminBadgeLima : adminBadgePending}>
            {isMpConnected ? "Conectado" : "Desconectado"}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {isMpConnected ? `MP User ID: ${mpUserId ?? "—"}` : "Conectá tu cuenta para cobrar reservas online."}
        </p>
        <span className="mt-3 inline-flex rounded-xl bg-[var(--bg-card)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]">
          {isMpConnected ? "Reconectar" : "Conectar ahora"}
        </span>
      </Link>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2.5">
        <input type="checkbox" name="accepts_cash" defaultChecked={initial.accepts_cash} className="h-4 w-4 rounded border-[var(--border-default)]" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Efectivo en el club</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-transparent px-3 py-2.5">
        <input
          type="checkbox"
          name="accepts_transfer"
          defaultChecked={initial.accepts_transfer}
          className="h-4 w-4 rounded border-[var(--border-default)]"
        />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Transferencia bancaria</span>
      </label>
      <label className="block space-y-1">
        <span className="font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Alias</span>
        <input name="bank_alias" defaultValue={initial.bank_alias} placeholder="Ej. mi.alias.mp" className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">CBU (opcional)</span>
        <input name="bank_cbu" defaultValue={initial.bank_cbu} className={inputClass} />
      </label>
      <button type="submit" className={adminCTAPrimary}>
        Guardar métodos de pago
      </button>
    </form>
  );
}
