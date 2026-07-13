"use client";

import { useState } from "react";

export default function ActivateSubscriptionButton({ clubId }: { clubId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mp/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      const data = (await res.json().catch(() => ({}))) as { subscriptionUrl?: string; error?: string };
      if (!res.ok || !data.subscriptionUrl) {
        setError(data.error ?? "No pudimos generar el link de suscripción. Intentá de nuevo.");
        setLoading(false);
        return;
      }
      window.location.href = data.subscriptionUrl;
    } catch {
      setError("No pudimos conectar con Mercado Pago. Intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
      >
        {loading ? "Generando link…" : "Activar suscripción con débito automático"}
      </button>
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
