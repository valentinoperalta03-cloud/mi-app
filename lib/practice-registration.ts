/** Estados que ocupan un cupo de la clase. */
export function practiceRegistrationHoldsSpot(paymentStatus: string | null | undefined): boolean {
  const s = String(paymentStatus ?? "").toLowerCase();
  return (
    s === "approved" ||
    s === "pending" ||
    s === "cash_pending" ||
    s === "transfer_pending"
  );
}

export function practicePaymentStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "cash_pending") return "Efectivo pendiente";
  if (s === "transfer_pending") return "Transferencia pendiente";
  if (s === "approved") return "Pagado";
  if (s === "pending") return "Pago MP pendiente";
  if (s === "cancelled") return "Cancelado";
  return status ?? "—";
}
