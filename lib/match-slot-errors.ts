/** Violación de índice único de slot o EXCLUDE de solapamiento en `matches`. */
export function isMatchSlotConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  if (code === "23505" || code === "23P01") return true;
  const msg = String("message" in error ? (error as { message?: string }).message ?? "" : "").toLowerCase();
  return msg.includes("unique_court_slot") || msg.includes("sin_partidos_superpuestos") || msg.includes("overlap");
}
