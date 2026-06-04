"use client";

import { useState, useTransition } from "react";
import { beginPracticeCheckoutAction } from "./actions";

export default function PracticeRegisterForm({
  sessionId,
  canRegister,
  priceLabel,
}: {
  sessionId: string;
  canRegister: boolean;
  priceLabel: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!canRegister) return null;

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inscribirse</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Total a pagar: {priceLabel}</p>
      {msg ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{msg}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          const fd = new FormData();
          fd.set("session_id", sessionId);
          start(async () => {
            const res = await beginPracticeCheckoutAction(fd);
            if (!res.ok) {
              setMsg(res.message);
              return;
            }
            if (res.url) window.location.href = res.url;
          });
        }}
        className="mt-4 w-full rounded-2xl bg-[#0461C4] py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Procesando…" : "Pagar con Mercado Pago"}
      </button>
    </div>
  );
}
