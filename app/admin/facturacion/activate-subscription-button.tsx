"use client";

import { useState } from "react";

const VARIANT_CLASSES: Record<"primary" | "danger", string> = {
  primary: "bg-[#0585FC] hover:brightness-105",
  danger: "bg-rose-600 hover:bg-rose-700",
};

export default function ActivateSubscriptionButton({
  clubId,
  label = "Activar suscripción con débito automático",
  variant = "primary",
}: {
  clubId: string;
  label?: string;
  variant?: "primary" | "danger";
}) {
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
        className={`w-full rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${VARIANT_CLASSES[variant]}`}
      >
        {loading ? "Generando link…" : label}
      </button>
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
