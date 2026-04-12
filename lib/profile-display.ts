/** Texto para tarjeta "Nivel": categoría + valor numérico. */
export function formatProfileNivel(
  category: string | null | undefined,
  level: string | number | null | undefined
): string {
  const cat = typeof category === "string" ? category.trim() : "";
  const lv =
    level === null || level === undefined || level === ""
      ? ""
      : typeof level === "number" && Number.isFinite(level)
        ? String(level)
        : String(level).trim();
  if (cat && lv) return `${cat} · ${lv}`;
  if (cat) return cat;
  if (lv) return lv;
  return "—";
}

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
