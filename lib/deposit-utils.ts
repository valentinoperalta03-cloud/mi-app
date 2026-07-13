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
