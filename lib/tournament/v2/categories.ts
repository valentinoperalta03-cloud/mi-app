import type { CategoryRule, Modality, PlayerProfileForCategory } from "./types";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 8;
/** 8va + 8va: ninguna suma puede superar este valor. */
export const MAX_SUMA = 16;
export const MIN_SUMA = 2;

export type CategoryCheck =
  | { ok: true }
  | { ok: false; reason: CategoryRejection; message: string };

export type CategoryRejection =
  | "missing_category"
  | "missing_gender"
  | "level_not_allowed"
  | "suma_mismatch"
  | "suma_unreachable"
  | "modality_mismatch"
  | "invalid_rule";

const MESSAGES: Record<CategoryRejection, string> = {
  missing_category: "Los jugadores tienen que tener su categoría cargada en el perfil.",
  missing_gender: "Los jugadores tienen que tener su género cargado en el perfil.",
  level_not_allowed: "La categoría de un jugador no corresponde a este torneo.",
  suma_mismatch: "La suma de categorías de la pareja no coincide con la del torneo.",
  suma_unreachable: "Tu categoría no permite formar una pareja con esta suma.",
  modality_mismatch: "La pareja no corresponde a la modalidad del torneo.",
  invalid_rule: "La categoría del torneo está mal configurada.",
};

function reject(reason: CategoryRejection): CategoryCheck {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/**
 * profiles.category guarda "1ra".."8va" y, en perfiles viejos, variantes como
 * "8va · Principiante". Devuelve el número (8va → 8) o null si no se reconoce.
 */
export function parseCategoryLevel(category: string | null | undefined): number | null {
  const m = /^\s*([1-8])\s*(ra|da|ta|ma|va)(?![a-z])/i.exec(String(category ?? ""));
  return m ? Number(m[1]) : null;
}

export function formatLevel(level: number): string {
  const suffix: Record<number, string> = { 1: "ra", 2: "da", 3: "ra", 4: "ta", 5: "ta", 6: "ta", 7: "ma", 8: "va" };
  return `${level}${suffix[level] ?? ""}`;
}

function isLevel(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= MIN_LEVEL && (n as number) <= MAX_LEVEL;
}

export function validateSumaTarget(target: number): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(target)) return { ok: false, message: "La suma tiene que ser un número entero." };
  if (target > MAX_SUMA) return { ok: false, message: `La suma no puede superar ${MAX_SUMA}.` };
  if (target < MIN_SUMA) return { ok: false, message: `La suma mínima es ${MIN_SUMA}.` };
  return { ok: true };
}

export function validateCategoryRule(rule: CategoryRule): { ok: true } | { ok: false; message: string } {
  if (rule.kind === "traditional") {
    if (rule.levels.length === 0 || !rule.levels.every(isLevel)) {
      return { ok: false, message: "Elegí una categoría válida." };
    }
  }
  if (rule.kind === "suma") return validateSumaTarget(rule.sumaTarget);
  return { ok: true };
}

type Gender = "masculino" | "femenino";

function normalizeGender(g: string | null): Gender | null {
  return g === "masculino" || g === "femenino" ? g : null;
}

function checkPairModality(modality: Modality | null, a: PlayerProfileForCategory, b: PlayerProfileForCategory): CategoryCheck {
  if (!modality) return { ok: true };
  const ga = normalizeGender(a.gender);
  const gb = normalizeGender(b.gender);
  if (!ga || !gb) return reject("missing_gender");
  if (modality === "caballeros" && (ga !== "masculino" || gb !== "masculino")) return reject("modality_mismatch");
  if (modality === "damas" && (ga !== "femenino" || gb !== "femenino")) return reject("modality_mismatch");
  if (modality === "mixto" && ga === gb) return reject("modality_mismatch");
  return { ok: true };
}

/**
 * Valida una pareja completa contra la categoría (nivel/suma + modalidad).
 *
 * Categoría tradicional (decisión de producto, sin ambigüedad): el club
 * elige explícitamente el conjunto de niveles permitidos (`rule.levels`,
 * ej. [7, 8] para "7ma y 8va"). La regla es únicamente
 * `player.level IN rule.levels` — sin inferir jerarquías ni permitir que
 * alguien "suba" o "baje" de categoría automáticamente. Si el club solo
 * marca 8va, un jugador de 7ma queda afuera aunque 7ma sea "más alta".
 */
export function checkPairForCategory(
  rule: CategoryRule,
  a: PlayerProfileForCategory,
  b: PlayerProfileForCategory,
): CategoryCheck {
  const ruleOk = validateCategoryRule(rule);
  if (!ruleOk.ok) return reject("invalid_rule");

  if (rule.kind === "traditional") {
    if (!isLevel(a.level) || !isLevel(b.level)) return reject("missing_category");
    if (!rule.levels.includes(a.level) || !rule.levels.includes(b.level)) return reject("level_not_allowed");
  } else if (rule.kind === "suma") {
    if (!isLevel(a.level) || !isLevel(b.level)) return reject("missing_category");
    if (a.level + b.level !== rule.sumaTarget) return reject("suma_mismatch");
  }

  return checkPairModality(rule.modality, a, b);
}

/**
 * Valida a un jugador solo (ej. "busco compañero"): que pueda existir algún
 * compañero con el que la pareja sea válida.
 */
export function checkPlayerForCategory(rule: CategoryRule, p: PlayerProfileForCategory): CategoryCheck {
  const ruleOk = validateCategoryRule(rule);
  if (!ruleOk.ok) return reject("invalid_rule");

  if (rule.kind === "traditional") {
    if (!isLevel(p.level)) return reject("missing_category");
    if (!rule.levels.includes(p.level)) return reject("level_not_allowed");
  } else if (rule.kind === "suma") {
    if (!isLevel(p.level)) return reject("missing_category");
    if (!isLevel(rule.sumaTarget - p.level)) return reject("suma_unreachable");
  }

  if (rule.modality) {
    const g = normalizeGender(p.gender);
    if (!g) return reject("missing_gender");
    if (rule.modality === "caballeros" && g !== "masculino") return reject("modality_mismatch");
    if (rule.modality === "damas" && g !== "femenino") return reject("modality_mismatch");
  }
  return { ok: true };
}
