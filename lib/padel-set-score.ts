/** Juegos por set al estilo pádel/tenis: 6 con diferencia 2, 7-5, 7-6 tie-break; 6-5 inválido. */
export function isValidPadelSet(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if (a === b) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const diff = hi - lo;
  if (hi < 6) return false;
  if (hi === 7 && lo === 6) return true;
  if (hi === 7 && lo === 5) return true;
  if (hi === 6 && lo === 5) return false;
  if (hi === 6 && lo <= 4) return diff >= 2;
  if (hi > 7 && lo >= 6 && diff === 2) return true;
  return false;
}

/** Mejor de 3 sets: 2 sets con el mismo ganador, o 3 sets con marcador 2-1. */
export function validateBestOfThreeSets(sets: { a: number; b: number }[]): {
  ok: boolean;
  message?: string;
  setsWonA?: number;
  setsWonB?: number;
} {
  if (sets.length < 2 || sets.length > 3) {
    return { ok: false, message: "Indicá 2 o 3 sets según el resultado del partido." };
  }
  for (const s of sets) {
    if (!isValidPadelSet(s.a, s.b)) {
      return {
        ok: false,
        message: `Marcador de set inválido (${s.a}-${s.b}). En pádel un set se gana a 6 con diferencia de 2, 7-5 o 7-6 (tie-break).`,
      };
    }
  }
  let wa = 0;
  let wb = 0;
  for (const s of sets) {
    if (s.a > s.b) wa += 1;
    else wb += 1;
  }
  if (sets.length === 2) {
    if (wa === 2 || wb === 2) return { ok: true, setsWonA: wa, setsWonB: wb };
    return { ok: false, message: "Con 2 sets el mismo equipo debe ganar ambos (2-0)." };
  }
  if ((wa === 2 && wb === 1) || (wb === 2 && wa === 1)) {
    return { ok: true, setsWonA: wa, setsWonB: wb };
  }
  return {
    ok: false,
    message: "Con 3 sets el marcador debe ser 2-1 (cada equipo ganó un set y el tercero define).",
  };
}
