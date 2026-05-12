import { LEVEL_HIERARCHY } from "@/lib/match-level";

/** Índice 0 = 8va … 7 = 1ra; devuelve el centro de banda [i, i+1) en ELO 0–8. */
export function eloCenterForCategoryIndex(index: number): number {
  if (index < 0) return 3.5;
  if (index > 7) return 7.5;
  return index + 0.5;
}

/** Valor mínimo de ELO del tramo (inclusive) para el índice en LEVEL_HIERARCHY. */
export function eloBandMin(index: number): number {
  return Math.max(0, Math.min(7, index));
}

/** Valor máximo de ELO del tramo (exclusive superior, inclusive 8 solo en 1ra). */
export function eloBandMax(index: number): number {
  if (index >= 7) return 8;
  return index + 1;
}

export function playerLevelInTournamentBounds(
  level: number | null | undefined,
  categoryMin: number | null | undefined,
  categoryMax: number | null | undefined
): boolean {
  if (categoryMin == null && categoryMax == null) return true;
  const lv = level != null && Number.isFinite(Number(level)) ? Number(level) : 3;
  const min = categoryMin != null && Number.isFinite(Number(categoryMin)) ? Number(categoryMin) : 0;
  const max = categoryMax != null && Number.isFinite(Number(categoryMax)) ? Number(categoryMax) : 8;
  return lv >= min && lv <= max;
}

export function formatCategoryRange(
  categoryMin: number | null | undefined,
  categoryMax: number | null | undefined
): string {
  if (categoryMin == null && categoryMax == null) return "Libre";
  const iMin =
    categoryMin != null && Number.isFinite(Number(categoryMin))
      ? Math.max(0, Math.min(7, Math.floor(Number(categoryMin))))
      : 0;
  const iMax =
    categoryMax != null && Number.isFinite(Number(categoryMax))
      ? Math.max(0, Math.min(7, Math.floor(Number(categoryMax))))
      : 7;
  const a = LEVEL_HIERARCHY[iMin]?.split("·")[0]?.trim() ?? "";
  const b = LEVEL_HIERARCHY[iMax]?.split("·")[0]?.trim() ?? "";
  if (a && b && a !== b) return `${a} a ${b}`;
  return a || "Libre";
}
