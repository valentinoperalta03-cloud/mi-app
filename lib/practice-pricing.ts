export type PracticePriceBreakdown = {
  /** Lo que configuró el club; el jugador paga exactamente este monto. */
  clubPriceBase: number;
};

export function practicePriceBreakdown(priceBase: number): PracticePriceBreakdown {
  const clubPriceBase = Math.round(Number(priceBase) * 100) / 100;
  if (!Number.isFinite(clubPriceBase) || clubPriceBase < 0) {
    return { clubPriceBase: 0 };
  }
  return { clubPriceBase };
}
