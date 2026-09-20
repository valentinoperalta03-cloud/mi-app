/** Partidos de un todos-contra-todos de N parejas: C(N,2). */
export function roundRobinMatchCount(pairs: number): number {
  if (!Number.isInteger(pairs) || pairs < 2) return 0;
  return (pairs * (pairs - 1)) / 2;
}

/**
 * Reparte parejas en zonas lo más parejo posible (diferencia máxima 1).
 * Las zonas más grandes van primero: 14/3 → [5,5,4]; 17/4 → [5,4,4,4].
 * Devuelve null si alguna zona quedaría con menos de 2 parejas.
 */
export function distributeZones(totalPairs: number, zoneCount: number): number[] | null {
  if (!Number.isInteger(totalPairs) || !Number.isInteger(zoneCount)) return null;
  if (zoneCount < 1 || totalPairs < zoneCount * 2) return null;
  const base = Math.floor(totalPairs / zoneCount);
  const extra = totalPairs % zoneCount;
  return Array.from({ length: zoneCount }, (_, i) => base + (i < extra ? 1 : 0));
}

export function totalZoneMatches(sizes: number[]): number {
  return sizes.reduce((acc, n) => acc + roundRobinMatchCount(n), 0);
}

export type ZonesEvaluation =
  | {
      ok: true;
      sizes: number[];
      minMatchesPerPair: number;
      maxMatchesPerPair: number;
      totalMatches: number;
    }
  | {
      ok: false;
      sizes: number[] | null;
      minMatchesPerPair: number | null;
      totalMatches: number | null;
      message: string;
    };

/**
 * Evalúa una configuración de zonas contra los partidos garantizados. En un
 * todos-contra-todos cada pareja juega tamaño_zona - 1, así que el mínimo lo
 * define la zona más chica.
 */
export function evaluateZones(totalPairs: number, zoneCount: number, guaranteedMatches: number): ZonesEvaluation {
  const sizes = distributeZones(totalPairs, zoneCount);
  if (!sizes) {
    return {
      ok: false,
      sizes: null,
      minMatchesPerPair: null,
      totalMatches: null,
      message: "Cada zona necesita al menos 2 parejas.",
    };
  }
  const minMatchesPerPair = Math.min(...sizes) - 1;
  const maxMatchesPerPair = Math.max(...sizes) - 1;
  const totalMatches = totalZoneMatches(sizes);
  if (!Number.isInteger(guaranteedMatches) || guaranteedMatches < 1) {
    return { ok: false, sizes, minMatchesPerPair, totalMatches, message: "Los partidos garantizados tienen que ser al menos 1." };
  }
  if (minMatchesPerPair < guaranteedMatches) {
    return {
      ok: false,
      sizes,
      minMatchesPerPair,
      totalMatches,
      message: `Con ${zoneCount} zonas (${sizes.join(" / ")}) algunas parejas juegan solo ${minMatchesPerPair} partido${minMatchesPerPair === 1 ? "" : "s"} y garantizaste ${guaranteedMatches}.`,
    };
  }
  return { ok: true, sizes, minMatchesPerPair, maxMatchesPerPair, totalMatches };
}

/** Todas las cantidades de zonas posibles para mostrarlas con su consecuencia. */
export function zoneCountOptions(totalPairs: number, guaranteedMatches: number): Array<{ zones: number; evaluation: ZonesEvaluation }> {
  const out: Array<{ zones: number; evaluation: ZonesEvaluation }> = [];
  for (let z = 1; z * 2 <= totalPairs; z++) {
    out.push({ zones: z, evaluation: evaluateZones(totalPairs, z, guaranteedMatches) });
  }
  return out;
}

/** Nombre de zona por índice: 0 → "A", 25 → "Z", 26 → "AA". */
export function zoneName(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}
