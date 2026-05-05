import { PAYMENT_COPY } from "@/lib/payment-copy";
import { Card } from "@/components/ui/card";

type Props = {
  /** Estado global del partido (tabla matches.payment_status / match_status derivado). */
  matchFullyPaid: boolean;
  /** Estado del pago del jugador actual (última fila payments). */
  myPaymentNorm: "approved" | "pending" | "rejected" | "expired" | "invited" | "none";
};

export function MatchStatusBanner({ matchFullyPaid, myPaymentNorm }: Props) {
  const mine =
    myPaymentNorm === "approved"
      ? PAYMENT_COPY.youPaidApproved
      : myPaymentNorm === "pending"
        ? PAYMENT_COPY.youPaidPending
        : myPaymentNorm === "invited"
          ? "Te invitaron — confirmá tu lugar cuando pagues tu parte."
          : myPaymentNorm === "rejected" || myPaymentNorm === "expired"
            ? PAYMENT_COPY.youPaidRejected
            : null;

  const globalCopy = matchFullyPaid ? PAYMENT_COPY.matchReserved : PAYMENT_COPY.matchWaitingPlayers;

  if (!mine && myPaymentNorm === "none") {
    return null;
  }

  return (
    <Card variant="highlight" className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {PAYMENT_COPY.yourPayment}
        </p>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {mine ?? "Sin pago registrado todavía."}
        </p>
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {PAYMENT_COPY.matchStatus}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">{globalCopy}</p>
      </div>
    </Card>
  );
}
