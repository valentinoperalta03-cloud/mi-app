"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PaymentPollStatus = "approved" | "pending" | "rejected" | "expired" | "cancelled" | "refunded" | string;

/**
 * Polling ligero para pantalla post-pago (solo pending).
 * Backoff 5s → 10s → 15s; tope 60s; respeta visibilityState.
 */
export function usePaymentStatus(paymentId: string | null, initialStatus: PaymentPollStatus | null) {
  const [status, setStatus] = useState<PaymentPollStatus | null>(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const statusRef = useRef<PaymentPollStatus | null>(initialStatus);

  const fetchOnce = useCallback(async () => {
    if (!paymentId) return;
    try {
      const res = await fetch(`/api/payments/${paymentId}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { status?: PaymentPollStatus };
      if (json.status) {
        statusRef.current = json.status;
        setStatus(json.status);
      }
    } catch {
      /* ignorar */
    }
  }, [paymentId]);

  useEffect(() => {
    const norm = String(initialStatus ?? "").toLowerCase();
    if (!paymentId || norm !== "pending") return;

    const started = Date.now();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timeoutId = setTimeout(() => void loop(), 5000);
        return;
      }

      await fetchOnce();

      const s = String(statusRef.current ?? "").toLowerCase();
      if (["approved", "rejected", "expired", "cancelled", "refunded"].includes(s)) {
        return;
      }

      const elapsed = Date.now() - started;
      if (elapsed >= 60000) {
        setTimedOut(true);
        return;
      }

      let delay = 5000;
      if (elapsed >= 30000) delay = 10000;
      if (elapsed >= 45000) delay = 15000;

      timeoutId = setTimeout(() => void loop(), delay);
    };

    void loop();

    const vis = () => {
      if (document.visibilityState === "visible") void fetchOnce();
    };
    document.addEventListener("visibilitychange", vis);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [paymentId, initialStatus, fetchOnce]);

  return { status, timedOut, refresh: fetchOnce };
}
