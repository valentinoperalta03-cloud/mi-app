import type { TournamentTypeKey } from "@/lib/tournament-constants";

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function validatePairsForType(
  type: TournamentTypeKey,
  count: number
): { ok: true } | { ok: false; message: string } {
  if (count < 2) return { ok: false, message: "Se necesitan al menos 2 inscripciones pagadas." };

  if (type === "eliminacion" && !isPowerOfTwo(count)) {
    return { ok: false, message: "Eliminacion directa requiere cantidad de parejas potencia de 2 (ej. 4, 8, 16)." };
  }
  if (type === "pena") {
    if (count < 4) return { ok: false, message: "Se necesitan al menos 4 jugadores inscriptos." };
    if (count % 2 !== 0) return { ok: false, message: "Se necesita un numero par de jugadores inscriptos." };
  }
  return { ok: true };
}
