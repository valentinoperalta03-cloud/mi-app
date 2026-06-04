import { PRACTICE_PLATFORM_FEE_RATE } from "@/lib/practice-constants";

export type PracticePriceBreakdown = {
  /** Lo que configuró el club (lo que debe recibir el club). */
  clubPriceBase: number;
  /** Comisión PadeLibre: 5% del precio base del club, NO del total del jugador. */
  platformFee: number;
  /** Lo que paga el jugador (base + comisión). */
  playerTotal: number;
};

export function practicePriceBreakdown(priceBase: number): PracticePriceBreakdown {
  const clubPriceBase = Math.round(Number(priceBase) * 100) / 100;
  if (!Number.isFinite(clubPriceBase) || clubPriceBase < 0) {
    return { clubPriceBase: 0, platformFee: 0, playerTotal: 0 };
  }
  const platformFee = Math.round(clubPriceBase * PRACTICE_PLATFORM_FEE_RATE * 100) / 100;
  const playerTotal = Math.round((clubPriceBase + platformFee) * 100) / 100;
  return { clubPriceBase, platformFee, playerTotal };
}

/** @deprecated Usar practicePriceBreakdown().platformFee */
export function practicePlatformFee(priceBase: number): number {
  return practicePriceBreakdown(priceBase).platformFee;
}

/** @deprecated Usar practicePriceBreakdown().playerTotal */
export function practiceTotalPrice(priceBase: number): number {
  return practicePriceBreakdown(priceBase).playerTotal;
}
