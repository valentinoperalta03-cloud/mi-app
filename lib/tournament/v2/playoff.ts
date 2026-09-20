export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * Tamaños de llave limpios (sin BYEs) después de zonas: potencias de 2,
 * nunca más plazas que parejas ni menos plazas que zonas.
 * 14 parejas / 3 zonas → [4, 8].
 */
export function playoffSizeOptions(totalPairs: number, zoneCount: number): number[] {
  const out: number[] = [];
  for (let size = 2; size <= totalPairs; size *= 2) {
    if (size >= zoneCount) out.push(size);
  }
  return out;
}

/** Partidos de una llave de eliminación directa sin 3er puesto. */
export function knockoutMatchCount(bracketSize: number): number {
  return isPowerOfTwo(bracketSize) && bracketSize >= 2 ? bracketSize - 1 : 0;
}

export function knockoutRoundName(matchesInRound: number): string {
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 4) return "Cuartos de final";
  if (matchesInRound === 8) return "Octavos de final";
  return `${matchesInRound * 2}avos de final`;
}

/** Rondas de la llave, de la primera a la final: 8 → cuartos(4), semis(2), final(1). */
export function knockoutRounds(bracketSize: number): Array<{ round: number; matches: number; name: string }> {
  const rounds: Array<{ round: number; matches: number; name: string }> = [];
  if (!isPowerOfTwo(bracketSize) || bracketSize < 2) return rounds;
  let matches = bracketSize / 2;
  let round = 1;
  while (matches >= 1) {
    rounds.push({ round, matches, name: knockoutRoundName(matches) });
    matches /= 2;
    round++;
  }
  return rounds;
}

export type QualificationLevel = {
  /** Posición en la tabla de zona (1 = primero). */
  position: number;
  /** Zonas que tienen una pareja en esta posición. */
  zonesWithPosition: number;
  /** true: clasifican todos los de esta posición. false: solo los mejores `takes`. */
  all: boolean;
  takes: number;
};

export type QualificationPlan =
  | { ok: true; levels: QualificationLevel[]; description: string }
  | { ok: false; message: string };

/**
 * Cómo se llena la llave: se clasifica por posición de forma pareja entre
 * zonas y las plazas que sobran se completan con los mejores de la siguiente
 * posición. 3 zonas / llave 8 → 1° y 2° de cada zona + 2 mejores 3°.
 */
export function qualificationPlan(zoneSizes: number[], bracketSize: number): QualificationPlan {
  const total = zoneSizes.reduce((a, b) => a + b, 0);
  if (zoneSizes.length === 0) return { ok: false, message: "No hay zonas." };
  if (!isPowerOfTwo(bracketSize) || bracketSize < 2) return { ok: false, message: "La llave tiene que ser de 2, 4, 8, 16…" };
  if (bracketSize < zoneSizes.length) return { ok: false, message: "La llave no puede tener menos plazas que zonas." };
  if (bracketSize > total) return { ok: false, message: "La llave no puede tener más plazas que parejas." };

  const levels: QualificationLevel[] = [];
  let remaining = bracketSize;
  let position = 1;
  while (remaining > 0) {
    const zonesWithPosition = zoneSizes.filter((s) => s >= position).length;
    if (zonesWithPosition === 0) return { ok: false, message: "No alcanzan las parejas para llenar la llave." };
    if (zonesWithPosition <= remaining) {
      levels.push({ position, zonesWithPosition, all: true, takes: zonesWithPosition });
      remaining -= zonesWithPosition;
    } else {
      levels.push({ position, zonesWithPosition, all: false, takes: remaining });
      remaining = 0;
    }
    position++;
  }
  return { ok: true, levels, description: describeQualification(levels) };
}

function ordinal(position: number): string {
  return `${position}°`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function describeQualification(levels: QualificationLevel[]): string {
  const direct = levels.filter((l) => l.all).map((l) => ordinal(l.position));
  const partial = levels.find((l) => !l.all);
  const parts: string[] = [];
  if (direct.length) parts.push(`${joinList(direct)} de cada zona`);
  if (partial) {
    parts.push(
      partial.takes === 1
        ? `el mejor ${ordinal(partial.position)}`
        : `los ${partial.takes} mejores ${ordinal(partial.position)}`,
    );
  }
  return parts.join(" + ");
}
