export const PROFILE_CATEGORIES = [
  "1ra",
  "2da",
  "3ra",
  "4ta",
  "5ta",
  "6ta",
  "7ma",
  "8va",
] as const;

export type ProfileCategoryValue = (typeof PROFILE_CATEGORIES)[number];

/** Texto visible para la categoría del jugador, ej. "8va categoría". */
export function formatPlayerCategory(category: string | null | undefined): string {
  const cat = typeof category === "string" ? category.trim() : "";
  if (!cat) return "Sin categoría";
  return `${cat} categoría`;
}
