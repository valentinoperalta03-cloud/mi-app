import { PAYMENT_COPY } from "@/lib/payment-copy";

type Props = {
  matchFullyPaid: boolean;
  myPaymentNorm: "approved" | "pending" | "rejected" | "expired" | "invited" | "none";
  confirmedPlayers?: number;
};

export function MatchStatusBanner({ matchFullyPaid, myPaymentNorm, confirmedPlayers }: Props) {
  const mine =
    myPaymentNorm === "approved"
      ? PAYMENT_COPY.youPaidApproved
      : myPaymentNorm === "pending"
        ? PAYMENT_COPY.youPaidPending
        : myPaymentNorm === "invited"
          ? "Tu lugar está reservado. Abonás en el club el día del partido."
          : myPaymentNorm === "rejected" || myPaymentNorm === "expired"
            ? PAYMENT_COPY.youPaidRejected
            : null;

  const globalCopy =
    confirmedPlayers === 4
      ? PAYMENT_COPY.matchAllConfirmed
      : matchFullyPaid
        ? PAYMENT_COPY.matchReserved
        : PAYMENT_COPY.matchWaitingPlayers;

  if (!mine && myPaymentNorm === "none") return null;

  const isConfirmed = myPaymentNorm === "approved";
  const isReserved = myPaymentNorm === "invited";

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        isConfirmed
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : isReserved
            ? "border-[#0585FC]/20 bg-[#0585FC]/5 dark:border-[#0585FC]/30 dark:bg-[#0585FC]/10"
            : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      }`}
    >
      <div className="space-y-1">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isConfirmed
              ? "text-emerald-700 dark:text-emerald-400"
              : isReserved
                ? "text-[#0461C4] dark:text-sky-400"
                : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {PAYMENT_COPY.yourPayment}
        </p>
        <p
          className={`text-sm font-medium ${
            isConfirmed
              ? "text-emerald-800 dark:text-emerald-300"
              : isReserved
                ? "text-[#0461C4] dark:text-sky-300"
                : "text-amber-800 dark:text-amber-300"
          }`}
        >
          {mine ?? "Sin pago registrado todavía."}
        </p>
      </div>
      <div
        className={`border-t pt-3 space-y-1 ${
          isConfirmed
            ? "border-emerald-200 dark:border-emerald-800"
            : isReserved
              ? "border-[#0585FC]/20 dark:border-[#0585FC]/30"
              : "border-amber-200 dark:border-amber-800"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isConfirmed
              ? "text-emerald-700 dark:text-emerald-400"
              : isReserved
                ? "text-[#0461C4] dark:text-sky-400"
                : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {PAYMENT_COPY.matchStatus}
        </p>
        <p
          className={`text-sm ${
            isConfirmed
              ? "text-emerald-700 dark:text-emerald-300"
              : isReserved
                ? "text-[#0461C4]/80 dark:text-sky-300/80"
                : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {globalCopy}
        </p>
      </div>
    </div>
  );
}
