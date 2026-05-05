"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { PAYMENT_COPY } from "@/lib/payment-copy";

function normalizeFromUrl(
  collectionStatus: string | undefined,
  status: string | undefined
): "approved" | "pending" | "failure" {
  const c = (collectionStatus ?? "").toLowerCase();
  const s = (status ?? "").toLowerCase();
  if (c === "approved" || s === "approved") return "approved";
  if (
    c === "failure" ||
    c === "rejected" ||
    s === "failure" ||
    s === "rejected" ||
    s === "cancelled" ||
    c === "cancelled"
  )
    return "failure";
  return "pending";
}

type Props = {
  matchId: string;
  paymentId: string | null;
  dbStatus: string | null;
  collectionStatus?: string;
  status?: string;
};

export function PartidoPagoReturn({ matchId, paymentId, dbStatus, collectionStatus, status }: Props) {
  const urlState = normalizeFromUrl(collectionStatus, status);
  const dbNorm = String(dbStatus ?? "").toLowerCase();

  const shouldPoll = Boolean(paymentId) && dbNorm === "pending" && urlState !== "failure";

  const { status: polled, timedOut } = usePaymentStatus(shouldPoll ? paymentId : null, shouldPoll ? "pending" : null);

  const effectiveStatus = useMemo(() => {
    const live = String(polled ?? dbStatus ?? "").toLowerCase();
    if (live === "approved") return "approved" as const;
    if (live === "rejected" || live === "expired") return "failure" as const;
    if (urlState === "approved") return "approved" as const;
    if (urlState === "failure") return "failure" as const;
    return "pending" as const;
  }, [polled, dbStatus, urlState]);

  return (
    <div className="space-y-6">
      {effectiveStatus === "approved" ? (
        <Card variant="highlight" className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{PAYMENT_COPY.approvedTitle}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{PAYMENT_COPY.approvedBody}</p>
        </Card>
      ) : null}

      {effectiveStatus === "failure" ? (
        <Card variant="default" className="space-y-3 border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30">
          <h1 className="text-xl font-bold text-rose-900 dark:text-rose-100">{PAYMENT_COPY.failureTitle}</h1>
          <p className="text-sm text-rose-800 dark:text-rose-200">{PAYMENT_COPY.failureBody}</p>
          <Link
            href={`/partidos/${matchId}`}
            className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.35)]"
            style={{ background: "var(--color-brand-gradient)" }}
          >
            {PAYMENT_COPY.retryCta}
          </Link>
        </Card>
      ) : null}

      {effectiveStatus === "pending" ? (
        <Card variant="default" className="space-y-3 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <h1 className="text-xl font-bold text-amber-950 dark:text-amber-100">{PAYMENT_COPY.pendingTitle}</h1>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {timedOut ? PAYMENT_COPY.pendingSlow : PAYMENT_COPY.pendingBody}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <Link
          href={`/partidos/${matchId}/chat`}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--color-brand)]/30 bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-dark)]"
        >
          {PAYMENT_COPY.openChat}
        </Link>
        <Link
          href={`/partidos/${matchId}`}
          className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-light)]"
        >
          {PAYMENT_COPY.backToMatch}
        </Link>
      </div>
    </div>
  );
}
