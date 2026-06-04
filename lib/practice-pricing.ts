import { PRACTICE_PLATFORM_FEE_RATE } from "@/lib/practice-constants";

export function practicePlatformFee(priceBase: number): number {
  const base = Number(priceBase);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * PRACTICE_PLATFORM_FEE_RATE);
}

export function practiceTotalPrice(priceBase: number): number {
  const base = Number(priceBase);
  if (!Number.isFinite(base) || base < 0) return 0;
  const fee = practicePlatformFee(base);
  return Math.round((base + fee) * 100) / 100;
}
