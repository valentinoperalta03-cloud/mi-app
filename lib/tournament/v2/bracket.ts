import { isPowerOfTwo, knockoutRoundName } from "./playoff";

/**
 * Orden estándar de siembra por posición de la llave: 8 → [1,8,4,5,2,7,3,6].
 * Cada par consecutivo es un cruce de primera ronda; 1 y 2 solo se cruzan en la final.
 */
export function bracketSeedOrder(size: number): number[] {
  if (!isPowerOfTwo(size) || size < 2) return [];
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((s) => [s, next + 1 - s]);
  }
  return order;
}

export type SeededEntry = { seed: number; pairId: string; zoneId: string | null };

export type FirstRoundMatch = {
  /** Posición del cruce en la primera ronda (0..size/2-1), de arriba hacia abajo. */
  slot: number;
  high: SeededEntry;
  low: SeededEntry;
  sameZone: boolean;
};

export type SeededBracket =
  | { ok: true; matches: FirstRoundMatch[]; sameZoneCount: number; explanation: string | null }
  | { ok: false; message: string };

function sameZone(a: SeededEntry, b: SeededEntry): boolean {
  return a.zoneId !== null && a.zoneId === b.zoneId;
}

/** Máximo emparejamiento bipartito (Kuhn) tops→lows usando solo aristas permitidas. */
function maxMatching(tops: SeededEntry[], lows: SeededEntry[], allowed: (t: SeededEntry, l: SeededEntry) => boolean): number {
  const matchOfLow = new Map<number, number>();
  function tryAssign(ti: number, seen: Set<number>): boolean {
    for (let li = 0; li < lows.length; li++) {
      if (seen.has(li) || !allowed(tops[ti], lows[li])) continue;
      seen.add(li);
      const current = matchOfLow.get(li);
      if (current === undefined || tryAssign(current, seen)) {
        matchOfLow.set(li, ti);
        return true;
      }
    }
    return false;
  }
  let size = 0;
  for (let ti = 0; ti < tops.length; ti++) if (tryAssign(ti, new Set())) size++;
  return size;
}

/**
 * Primera ronda determinística: mejor sembrado vs peor sembrado, evitando
 * cruces entre parejas de la misma zona cuando es matemáticamente posible.
 * Recorre los sembrados en orden y a cada uno le da el rival más cercano a
 * su rival ideal que todavía permita la cantidad mínima de cruces de misma zona.
 */
export function buildSeededFirstRound(entries: SeededEntry[]): SeededBracket {
  const n = entries.length;
  if (!isPowerOfTwo(n) || n < 2) return { ok: false, message: "La llave necesita 2, 4, 8, 16… parejas." };
  const sorted = [...entries].sort((a, b) => a.seed - b.seed);
  if (sorted.some((e, i) => e.seed !== i + 1)) return { ok: false, message: "Las siembras tienen que ser 1..N sin huecos." };

  const half = n / 2;
  const tops = sorted.slice(0, half);
  let lows = sorted.slice(half);
  const notSameZone = (t: SeededEntry, l: SeededEntry) => !sameZone(t, l);

  const allowedConflicts = half - maxMatching(tops, lows, notSameZone);
  let usedConflicts = 0;
  const opponentOf = new Map<number, SeededEntry>();

  for (let ti = 0; ti < tops.length; ti++) {
    const top = tops[ti];
    const ideal = n + 1 - top.seed;
    const candidates = [...lows].sort((a, b) => Math.abs(a.seed - ideal) - Math.abs(b.seed - ideal) || a.seed - b.seed);
    const restTops = tops.slice(ti + 1);
    let chosen: SeededEntry | null = null;
    for (const c of candidates) {
      const conflictsAfter = usedConflicts + (sameZone(top, c) ? 1 : 0);
      if (conflictsAfter > allowedConflicts) continue;
      const restLows = lows.filter((l) => l !== c);
      const needed = restTops.length - (allowedConflicts - conflictsAfter);
      if (needed <= 0 || maxMatching(restTops, restLows, notSameZone) >= needed) {
        chosen = c;
        usedConflicts = conflictsAfter;
        break;
      }
    }
    if (!chosen) return { ok: false, message: "No se pudo armar la llave." };
    opponentOf.set(top.seed, chosen);
    lows = lows.filter((l) => l !== chosen);
  }

  const order = bracketSeedOrder(n);
  const matches: FirstRoundMatch[] = tops
    .map((top) => {
      const low = opponentOf.get(top.seed)!;
      return { slot: Math.floor(order.indexOf(top.seed) / 2), high: top, low, sameZone: sameZone(top, low) };
    })
    .sort((a, b) => a.slot - b.slot);

  const sameZoneCount = matches.filter((m) => m.sameZone).length;
  return {
    ok: true,
    matches,
    sameZoneCount,
    explanation:
      sameZoneCount > 0
        ? `No es posible evitar ${sameZoneCount === 1 ? "un cruce" : `${sameZoneCount} cruces`} de primera ronda entre parejas de la misma zona.`
        : null,
  };
}

/** Fila de cuadro lista para insertar en tournament_matches (Fase C). */
export type SeededBracketRow = {
  id: string;
  round: number;
  roundName: string;
  slot: number;
  pair1Id: string | null;
  pair2Id: string | null;
  feederLeftMatchId: string | null;
  feederRightMatchId: string | null;
};

export type SeededEliminationFixture =
  | { ok: true; rows: SeededBracketRow[]; sameZoneCount: number; explanation: string | null }
  | { ok: false; message: string };

/**
 * Cuadro eliminatorio completo a partir de clasificados ya sembrados
 * (selectQualifiers): primera ronda por buildSeededFirstRound (mejor vs
 * peor, evita misma zona), rondas siguientes como placeholders encadenados
 * vía feeder_left/right_match_id — mismo patrón de encadenado que
 * buildEliminationFixture (fixture.ts), adaptado a entradas ya sembradas en
 * vez de un sorteo aleatorio.
 */
export function buildSeededEliminationFixture(entries: SeededEntry[]): SeededEliminationFixture {
  const first = buildSeededFirstRound(entries);
  if (!first.ok) return first;

  const n = entries.length;
  const round1: SeededBracketRow[] = first.matches.map((m) => ({
    id: crypto.randomUUID(),
    round: 1,
    roundName: knockoutRoundName(n / 2),
    slot: m.slot,
    pair1Id: m.high.pairId,
    pair2Id: m.low.pairId,
    feederLeftMatchId: null,
    feederRightMatchId: null,
  }));

  const rows: SeededBracketRow[] = [...round1];
  let prevLayer = round1;
  let round = 2;
  while (prevLayer.length > 1) {
    const layer: SeededBracketRow[] = [];
    for (let i = 0; i < prevLayer.length; i += 2) {
      layer.push({
        id: crypto.randomUUID(),
        round,
        roundName: knockoutRoundName(prevLayer.length / 2),
        slot: i / 2,
        pair1Id: null,
        pair2Id: null,
        feederLeftMatchId: prevLayer[i].id,
        feederRightMatchId: prevLayer[i + 1].id,
      });
    }
    rows.push(...layer);
    prevLayer = layer;
    round++;
  }

  return { ok: true, rows, sameZoneCount: first.sameZoneCount, explanation: first.explanation };
}
