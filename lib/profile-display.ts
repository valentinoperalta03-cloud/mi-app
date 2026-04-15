import { formatLevel } from "@/lib/level-quiz-logic";

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
  level_of_play?: string | null;
  technical_score?: number | null;
};

function officialFromClassifyLabel(label: string): string {
  const m = label.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return label;
  const category = (m[1] ?? "").trim();
  const desc = (m[2] ?? "").trim();
  return `${category} - ${desc}`;
}

export function formatOfficialCategoryFromLevel(level: number): string {
  return formatLevel(level);
}

export function splitOfficialCategoryLine(line: string): { category: string; description: string } {
  const [left, ...rest] = line.split(" - ");
  return {
    category: (left ?? "").trim(),
    description: rest.join(" - ").trim(),
  };
}

/** Prioriza `technical_score` (decimal + banda); si no hay, usa `level_of_play`. */
export function formatProfileNivelFromRow(row: ProfileNivelRow | null | undefined): string {
  if (!row) return "—";
  if (row.level != null && Number.isFinite(Number(row.level))) {
    return formatOfficialCategoryFromLevel(Number(row.level));
  }
  if (row.technical_score != null && Number.isFinite(Number(row.technical_score))) {
    const tech = Math.max(0, Math.min(7, Number(row.technical_score)));
    const normalizedLevel = 1 + (tech / 7) * 4;
    return formatOfficialCategoryFromLevel(normalizedLevel);
  }
  const play = row.level_of_play?.trim();
  if (!play) return "—";
  if (play.includes(" - ")) return play;
  if (play.includes("(") && play.includes(")")) return officialFromClassifyLabel(play);
  const normalized = play.toLowerCase();
  if (normalized.includes("elite") || normalized.includes("pro")) return "1ra/2da - Elite";
  if (normalized.includes("avanzado+")) return "3ra - Avanzado+";
  if (normalized.includes("avanzado")) return "4ta - Avanzado";
  if (normalized.includes("intermedio+")) return "5ta - Intermedio+";
  if (normalized.includes("intermedio")) return "6ta - Intermedio";
  if (normalized.includes("iniciacion+")) return "7ma - Iniciacion+";
  if (normalized.includes("principiante")) return "8va - Principiante";
  return play;
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
