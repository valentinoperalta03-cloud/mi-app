export const LEVEL_HIERARCHY = [
  "8va · Principiante",
  "7ma · Iniciación",
  "6ta · Intermedio",
  "5ta · Intermedio+",
  "4ta · Avanzado",
  "3ra · Avanzado+",
  "2da · Elite",
  "1ra · Elite",
] as const;

export type PlayerCategory = (typeof LEVEL_HIERARCHY)[number];

/** Índice 0 = más bajo (8va), mayor = más alto. Acepta etiqueta completa o prefijo "6ta". */
export function getLevelIndex(category: string | null | undefined): number {
  if (!category) return -1;
  const trimmed = category.trim();
  const direct = LEVEL_HIERARCHY.indexOf(trimmed as PlayerCategory);
  if (direct !== -1) return direct;
  const prefix = trimmed.split("·")[0]?.trim() ?? trimmed;
  for (let i = 0; i < LEVEL_HIERARCHY.length; i++) {
    const rowPrefix = LEVEL_HIERARCHY[i].split("·")[0]?.trim();
    if (rowPrefix === prefix) return i;
  }
  return -1;
}

/** El jugador puede unirse a partidos de su misma categoría ±1. */
export function isLevelCompatible(
  playerCategory: string | null | undefined,
  creatorCategory: string | null | undefined
): boolean {
  const playerIdx = getLevelIndex(playerCategory);
  const creatorIdx = getLevelIndex(creatorCategory);
  if (playerIdx === -1 || creatorIdx === -1) return false;
  return Math.abs(playerIdx - creatorIdx) <= 1;
}
