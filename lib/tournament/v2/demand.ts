import { americanoLoads, computeCapacity, eliminationLoads, formatMinutes, zonasLoads, type CapacityPlan } from "./capacity";
import { playoffSizeOptions } from "./playoff";
import type { TournamentFormats } from "./types";
import { zoneCountOptions } from "./zones";

export type CategoryDemandInput = {
  name: string;
  maxPairs: number;
  approvedCount: number;
  guaranteedMatches: number | null;
  /** Tamaños reales de zona si ya se generaron; vacío si todavía no. */
  zoneSizes: number[];
  /** Tamaño de cuadro ya decidido (categories_panel lo expone); null si no se generó. */
  bracketSize: number | null;
};

export type CategoryDemand = { name: string; plan: CapacityPlan | null; estimated: boolean; note: string | null };

export type TournamentDemand = {
  categories: CategoryDemand[];
  totalMatches: number;
  totalMinutes: number;
  anyEstimated: boolean;
};

/**
 * Demanda de horas-cancha de UNA categoría, sección 5 (incluye "zonas +
 * eliminación", sección explícita del pedido). Reusa computeCapacity /
 * *Loads de lib/tournament/v2/capacity.ts — no reimplementa el cálculo.
 *
 * "zonas" con zonas ya generadas: usa los tamaños REALES. Sin generar
 * todavía: estima con el cupo completo (maxPairs) y una distribución de
 * zonas recomendada (la primera que cumple los partidos garantizados),
 * dejando explícito que es una estimación (sección 5: "indicá claramente
 * que es estimada").
 */
export function categoryDemand(
  tournamentType: "americano" | "eliminacion" | "zonas" | "pena",
  cat: CategoryDemandInput,
  formats: TournamentFormats,
  consolationBracket: boolean,
  hasFinals: boolean,
): CategoryDemand {
  const estimated = cat.approvedCount < cat.maxPairs;

  if (tournamentType === "americano") {
    const loads = americanoLoads(cat.maxPairs, cat.guaranteedMatches ?? Math.max(1, cat.maxPairs - 1), hasFinals, formats);
    return { name: cat.name, plan: computeCapacity(loads), estimated, note: estimated ? "estimado a cupo completo" : null };
  }
  if (tournamentType === "eliminacion") {
    const loads = eliminationLoads(cat.maxPairs, consolationBracket, formats);
    return { name: cat.name, plan: computeCapacity(loads), estimated, note: estimated ? "estimado a cupo completo" : null };
  }
  if (tournamentType === "zonas") {
    if (cat.zoneSizes.length > 0) {
      const loads = zonasLoads(cat.zoneSizes, cat.bracketSize, formats);
      return { name: cat.name, plan: computeCapacity(loads), estimated: false, note: null };
    }
    if (cat.maxPairs < 4) {
      return { name: cat.name, plan: null, estimated: true, note: "faltan definir zonas (cupo insuficiente para estimar)" };
    }
    const options = zoneCountOptions(cat.maxPairs, cat.guaranteedMatches ?? 1).filter((o) => o.evaluation.ok);
    const recommended = options[Math.floor(options.length / 2)] ?? options[0];
    if (!recommended || !recommended.evaluation.ok) {
      return { name: cat.name, plan: null, estimated: true, note: "sin una distribución de zonas válida a cupo completo" };
    }
    const brackets = playoffSizeOptions(cat.maxPairs, recommended.zones);
    const bracketSize = brackets.length ? brackets[brackets.length - 1] : null;
    const loads = zonasLoads(recommended.evaluation.sizes, bracketSize, formats);
    return {
      name: cat.name,
      plan: computeCapacity(loads),
      estimated: true,
      note: `estimado a cupo completo (${cat.maxPairs}) con ${recommended.zones} zonas recomendadas`,
    };
  }
  // Peña: unidad de cupo es jugadores, no parejas — capacity.ts no modela ese caso; se omite del agregado.
  return { name: cat.name, plan: null, estimated: false, note: null };
}

export function tournamentDemand(
  tournamentType: "americano" | "eliminacion" | "zonas" | "pena",
  categories: CategoryDemandInput[],
  formats: TournamentFormats,
  consolationBracket: boolean,
  hasFinals: boolean,
): TournamentDemand {
  const catDemands = categories.map((c) => categoryDemand(tournamentType, c, formats, consolationBracket, hasFinals));
  const totalMatches = catDemands.reduce((a, c) => a + (c.plan?.totalMatches ?? 0), 0);
  const totalMinutes = catDemands.reduce((a, c) => a + (c.plan?.totalMinutes ?? 0), 0);
  return { categories: catDemands, totalMatches, totalMinutes, anyEstimated: catDemands.some((c) => c.estimated) };
}

export { formatMinutes };
