import { practicePlatformFee, practiceTotalPrice } from "@/lib/practice-pricing";

/** Monto que paga el jugador (precio base + 5%). */
export function practicePlayerPayAmount(priceBase: number): number {
  return practiceTotalPrice(priceBase);
}

/** Comisión PadeLibre que registra el club al confirmar cobro offline. */
export function practiceClubPadelibreDebt(priceBase: number): number {
  return practicePlatformFee(priceBase);
}
