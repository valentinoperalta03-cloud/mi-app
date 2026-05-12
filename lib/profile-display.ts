import { classifyCategory } from "@/lib/level-quiz-logic";

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

type ProfileNivelRow = {
  level?: number | null;
};

export type ProfileLevelParts = {
  category: string;
  elo: string;
  /** Progreso dentro de la parte decimal del ELO (0–100). */
  progressInEloUnit: number;
};

export function getProfileLevelParts(row: ProfileNivelRow | null | undefined): ProfileLevelParts | null {
  if (!row || row.level == null || !Number.isFinite(Number(row.level))) return null;
  const level = Math.max(0, Math.min(8, Number(row.level)));
  const frac = level - Math.floor(level);
  return {
    category: classifyCategory(level),
    elo: level.toFixed(1),
    progressInEloUnit: Math.round(frac * 100),
  };
}

export function formatOfficialCategoryFromLevel(level: number): string {
  return classifyCategory(level);
}

/**
 * Parsea líneas tipo "6ta · Intermedio · 4.2" (categoría + ELO) o legacy "x - y".
 */
export function splitOfficialCategoryLine(line: string): { category: string; description: string } {
  const trimmed = line.trim();
  const lastSep = trimmed.lastIndexOf(" · ");
  if (lastSep > 0) {
    const maybeElo = trimmed.slice(lastSep + 3).trim();
    if (/^\d+(\.\d+)?$/.test(maybeElo)) {
      return { category: trimmed.slice(0, lastSep).trim(), description: maybeElo };
    }
  }
  if (trimmed.includes(" - ")) {
    const [left, ...rest] = trimmed.split(" - ");
    return {
      category: (left ?? "").trim(),
      description: rest.join(" - ").trim(),
    };
  }
  return {
    category: trimmed,
    description: "",
  };
}

/** `level` es la fuente canónica del ELO competitivo (0–8). */
export function formatProfileNivelFromRow(row: ProfileNivelRow | null | undefined): string {
  const parts = getProfileLevelParts(row);
  if (!parts) return "Sin nivelar";
  return `${parts.category} · ${parts.elo}`;
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
