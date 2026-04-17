export const LEVEL_HIERARCHY = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da/1ra"] as const;

export type PlayerCategory = (typeof LEVEL_HIERARCHY)[number];

export function getLevelIndex(category: string | null | undefined): number {
  if (!category) return -1;
  return LEVEL_HIERARCHY.indexOf(category as PlayerCategory);
}

export function isLevelCompatible(
  playerCategory: string | null | undefined,
  creatorCategory: string | null | undefined
): boolean {
  const playerIdx = getLevelIndex(playerCategory);
  const creatorIdx = getLevelIndex(creatorCategory);
  if (playerIdx === -1 || creatorIdx === -1) return false;
  return Math.abs(playerIdx - creatorIdx) <= 1;
}
