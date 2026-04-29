export function sanitizeText(input: string, maxLength: number): string {
  const cleaned = String(input ?? "")
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, "");
  if (!Number.isFinite(maxLength) || maxLength <= 0) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength);
}
