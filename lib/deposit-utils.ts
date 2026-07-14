export function calculateDepositAmount(
  totalPrice: number,
  depositType: "percentage" | "fixed",
  depositValue: number
): number {
  if (depositType === "percentage") {
    return Math.round((totalPrice * depositValue) / 100);
  }
  return depositValue;
}

/**
 * Monto a cobrar por Mercado Pago segun la seña configurada a nivel club.
 * Si el club todavia no configuro su seña (deposit_value === 0), se cobra
 * el 100% del turno — no se confirma gratis.
 */
export function resolveDepositCharge(
  totalPrice: number,
  depositType: "percentage" | "fixed" | null,
  depositValue: number
): number {
  if (!depositValue || depositValue <= 0) return totalPrice;
  return calculateDepositAmount(totalPrice, depositType ?? "fixed", depositValue);
}
