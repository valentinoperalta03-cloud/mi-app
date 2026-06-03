export type PlayerPaymentMethod = "mercadopago" | "cash" | "transfer";

export function normalizePlayerPaymentMethod(raw: string): PlayerPaymentMethod | null {
  const s = raw.trim().toLowerCase();
  if (s === "mercadopago" || s === "cash" || s === "transfer") return s;
  return null;
}

/** Cuota jugador (1/4 del turno) + 5% comisión, alineado con reservas / MP. */
export function playerShareWithMarketplaceFee(totalCourtPrice: number) {
  const perPlayerBase = Math.round(totalCourtPrice / 4);
  const marketplaceFee = Math.round(perPlayerBase * 0.05);
  const total = perPlayerBase + marketplaceFee;
  return { perPlayerBase, marketplaceFee, total };
}

/** Deuda PadeLibre del club: 5% del precio total del turno (regla de negocio offline). */
export function clubPadelibreDebtFromTurn(totalCourtPrice: number) {
  const n = Number(totalCourtPrice);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const perPlayerBase = Math.round(n / 4);
  return Math.round(perPlayerBase * 0.05 * 100) / 100;
}

export function isReservationSlotBlockingPaymentStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "paid" || s === "pending" || s === "cash_pending" || s === "transfer_pending";
}
