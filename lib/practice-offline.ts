import { practicePriceBreakdown } from "@/lib/practice-pricing";

/** Monto que paga el jugador (precio base del club + 5% de ese base). */
export function practicePlayerPayAmount(priceBase: number): number {
  return practicePriceBreakdown(priceBase).playerTotal;
}

/** Comisión PadeLibre (5% del precio base del club) al confirmar cobro offline. */
export function practiceClubPadelibreDebt(priceBase: number): number {
  return practicePriceBreakdown(priceBase).platformFee;
}
