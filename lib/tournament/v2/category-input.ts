import { MAX_LEVEL, MAX_SUMA, MIN_LEVEL, MIN_SUMA } from "./categories";
import type { Modality } from "./types";

/**
 * Forma de una categoría tal como la arma el wizard de creación/edición
 * (Fase B) — mapea 1:1 a columnas de tournament_categories. Validado acá con
 * las mismas reglas que ya exigían los CHECK de la migración
 * 20260917100200_tournaments_v2_category_pricing.sql, para dar un mensaje
 * legible ANTES de pegarle a la base.
 */
export type CategoryInput = {
  name: string;
  modality: Modality | null;
  categoryKind: "open" | "traditional" | "suma";
  levels?: number[] | null;
  sumaTarget?: number | null;
  maxPairs: number;
  guaranteedMatches?: number | null;
  pricePerPair: number;
  priceUnit: "pair" | "player";
  requiresDeposit: boolean;
  depositType?: "percentage" | "fixed" | null;
  depositValue?: number | null;
  acceptsMp: boolean;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
};

export type CategoryValidation = { ok: true } | { ok: false; message: string };

function isLevel(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= MIN_LEVEL && (n as number) <= MAX_LEVEL;
}

export function validateCategoryInput(input: CategoryInput): CategoryValidation {
  if (!input.name.trim()) return { ok: false, message: "El nombre de la categoría es obligatorio." };

  if (input.categoryKind === "traditional") {
    const levels = input.levels ?? [];
    if (levels.length === 0 || !levels.every(isLevel)) {
      return { ok: false, message: "Elegí al menos una categoría permitida (8va, 7ma, …)." };
    }
  } else if (input.categoryKind === "suma") {
    const target = input.sumaTarget;
    if (!Number.isInteger(target) || target! < MIN_SUMA || target! > MAX_SUMA) {
      return { ok: false, message: `La suma tiene que ser un entero entre ${MIN_SUMA} y ${MAX_SUMA}.` };
    }
  }

  if (!Number.isInteger(input.maxPairs) || input.maxPairs < 2) {
    return { ok: false, message: "El cupo tiene que ser al menos 2." };
  }
  if (input.guaranteedMatches != null && (!Number.isInteger(input.guaranteedMatches) || input.guaranteedMatches < 1)) {
    return { ok: false, message: "Los partidos garantizados tienen que ser al menos 1." };
  }
  if (!Number.isFinite(input.pricePerPair) || input.pricePerPair < 0) {
    return { ok: false, message: "El precio no puede ser negativo." };
  }
  if (!input.acceptsMp && !input.acceptsCash && !input.acceptsTransfer) {
    return { ok: false, message: `"${input.name}": elegí al menos un método de pago.` };
  }
  if (input.requiresDeposit) {
    if (input.depositType !== "percentage" && input.depositType !== "fixed") {
      return { ok: false, message: `"${input.name}": elegí el tipo de seña.` };
    }
    const value = Number(input.depositValue ?? 0);
    if (!Number.isFinite(value)) return { ok: false, message: `"${input.name}": monto de seña inválido.` };
    if (input.depositType === "percentage" && (value < 1 || value > 100)) {
      return { ok: false, message: `"${input.name}": el porcentaje de seña debe estar entre 1 y 100.` };
    }
    if (input.depositType === "fixed" && value <= 0) {
      return { ok: false, message: `"${input.name}": el monto fijo de seña debe ser mayor a 0.` };
    }
  }
  return { ok: true };
}

/**
 * Campos "estructura competitiva": determinan quién puede inscribirse.
 * Cambiarlos con inscripciones vivas podría dejar inscriptos que ya no
 * cumplen la regla nueva — se bloquea en vez de revalidar en silencio
 * (decisión de producto explícita: preferencia por bloquear).
 */
export type CategoryStructuralFields = {
  modality: Modality | null;
  categoryKind: "open" | "traditional" | "suma";
  levels: number[] | null;
  sumaTarget: number | null;
};

function sameLevels(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  const as = [...(a ?? [])].sort((x, y) => x - y);
  const bs = [...(b ?? [])].sort((x, y) => x - y);
  return as.length === bs.length && as.every((v, i) => v === bs[i]);
}

/** true si cambiar de `current` a `next` tocaría quién es elegible para la categoría. */
export function structuralFieldsChanged(current: CategoryStructuralFields, next: CategoryStructuralFields): boolean {
  return (
    current.modality !== next.modality ||
    current.categoryKind !== next.categoryKind ||
    (current.sumaTarget ?? null) !== (next.sumaTarget ?? null) ||
    !sameLevels(current.levels, next.levels)
  );
}

/** El cupo se puede subir siempre; bajarlo está limitado por las inscripciones vivas actuales. */
export function validateMaxPairsChange(newMaxPairs: number, liveRegistrationsCount: number): CategoryValidation {
  if (newMaxPairs < liveRegistrationsCount) {
    return {
      ok: false,
      message: `No se puede bajar el cupo a ${newMaxPairs}: ya hay ${liveRegistrationsCount} inscripciones vivas.`,
    };
  }
  return { ok: true };
}

/** Valida una lista completa y devuelve el primer error, o nombres duplicados. */
export function validateCategoryInputs(inputs: CategoryInput[]): CategoryValidation {
  if (inputs.length === 0) return { ok: false, message: "Agregá al menos una categoría." };
  const names = new Set<string>();
  for (const input of inputs) {
    const check = validateCategoryInput(input);
    if (!check.ok) return check;
    const key = input.name.trim().toLowerCase();
    if (names.has(key)) return { ok: false, message: `Hay dos categorías con el mismo nombre: "${input.name}".` };
    names.add(key);
  }
  return { ok: true };
}
