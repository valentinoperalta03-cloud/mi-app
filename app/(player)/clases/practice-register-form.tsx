"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Banknote, CreditCard } from "lucide-react";
import { registerForPracticeAction } from "./actions";

type PaymentMethod = "mercadopago" | "cash" | "transfer";

type Props = {
  sessionId: string;
  canRegister: boolean;
  priceLabel: string;
  clubHasMp: boolean;
  clubAcceptsCash: boolean;
  clubAcceptsTransfer: boolean;
  bankAlias: string | null;
  bankCbu: string | null;
};

export default function PracticeRegisterForm({
  sessionId,
  canRegister,
  priceLabel,
  clubHasMp,
  clubAcceptsCash,
  clubAcceptsTransfer,
  bankAlias,
  bankCbu,
}: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const hasAny =
    clubHasMp || clubAcceptsCash || clubAcceptsTransfer;

  if (!canRegister || !hasAny) return null;

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inscribirse</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Total a pagar: {priceLabel}</p>

      <p className="mt-4 text-xs font-semibold text-[var(--text-tertiary)]">¿Cómo querés pagar?</p>
      <div className="mt-2 space-y-2">
        {clubHasMp ? (
          <button
            type="button"
            onClick={() => setMethod("mercadopago")}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
              method === "mercadopago"
                ? "border-[#0461C4] bg-[#0461C4]/5"
                : "border-[var(--border-subtle)]"
            }`}
          >
            <CreditCard size={20} className="shrink-0 text-[#0461C4]" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Mercado Pago</p>
              <p className="text-xs text-[var(--text-tertiary)]">Pagá online ahora</p>
            </div>
          </button>
        ) : null}

        {clubAcceptsTransfer ? (
          <button
            type="button"
            onClick={() => setMethod("transfer")}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
              method === "transfer"
                ? "border-[#0461C4] bg-[#0461C4]/5"
                : "border-[var(--border-subtle)]"
            }`}
          >
            <ArrowRightLeft size={20} className="shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Transferencia</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {bankAlias ? `Alias: ${bankAlias}` : bankCbu ? `CBU: ${bankCbu}` : "Transferí antes de ir al club"}
              </p>
            </div>
          </button>
        ) : null}

        {clubAcceptsCash ? (
          <button
            type="button"
            onClick={() => setMethod("cash")}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
              method === "cash" ? "border-[#0461C4] bg-[#0461C4]/5" : "border-[var(--border-subtle)]"
            }`}
          >
            <Banknote size={20} className="shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Efectivo</p>
              <p className="text-xs text-[var(--text-tertiary)]">Pagás en el club el día de la clase</p>
            </div>
          </button>
        ) : null}
      </div>

      {msg ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{msg}</p> : null}

      <button
        type="button"
        disabled={!method || pending}
        onClick={() => {
          setMsg(null);
          const fd = new FormData();
          fd.set("session_id", sessionId);
          fd.set("payment_method", method!);
          start(async () => {
            const res = await registerForPracticeAction(fd);
            if (!res.ok) {
              setMsg(res.message);
              return;
            }
            if (res.url) window.location.href = res.url;
          });
        }}
        className="mt-4 w-full rounded-2xl bg-[#0461C4] py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Procesando…" : "Confirmar inscripción"}
      </button>
    </div>
  );
}
