export type PlayerPaymentMethod = "mercadopago" | "cash" | "transfer";

export function normalizePlayerPaymentMethod(raw: string): PlayerPaymentMethod | null {
  const s = raw.trim().toLowerCase();
  if (s === "mercadopago" || s === "cash" || s === "transfer") return s;
  return null;
}

export function isReservationSlotBlockingPaymentStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "paid" || s === "pending" || s === "cash_pending" || s === "transfer_pending";
}

/**
 * Campos financieros del match cuando el club confirma un cobro offline
 * (efectivo/transferencia) por el total del turno, sin retención de plataforma.
 */
export function resolveOfflinePaymentConfirmation(totalPrice: number) {
  const amountPaid = Number(totalPrice) || 0;
  return {
    amountPaid,
    amountPending: 0,
    financialStatus: "fully_paid" as const,
  };
}
