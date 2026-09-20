export type AmericanoPairings = {
  /** Cruces por índice de pareja (i < j), ordenados. */
  matches: Array<[number, number]>;
  matchesPerTeam: number[];
  /** Índice de la pareja que juega un partido extra (solo si N × garantizados es impar). */
  extraMatchTeam: number | null;
  /** true si hubo que repetir rivales (garantizados > N-1). */
  repeatsOpponents: boolean;
};

function key(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Cruces de un grafo circulante: cada pareja i enfrenta a i±1..i±d. Si
 * `withDiameter` (N par), además a i+N/2. Sin rivales repetidos.
 */
function circulant(n: number, halfDegree: number, withDiameter: boolean): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let d = 1; d <= halfDegree; d++) {
    for (let i = 0; i < n; i++) {
      const j = (i + d) % n;
      edges.push(i < j ? [i, j] : [j, i]);
    }
  }
  if (withDiameter) {
    for (let i = 0; i < n / 2; i++) edges.push([i, i + n / 2]);
  }
  return edges;
}

/** Grafo simple con todos en grado k (o uno solo en k+1 si N·k es impar). Requiere 1 ≤ k ≤ N-1. */
function nearRegular(n: number, k: number): { edges: Array<[number, number]>; extra: number | null } {
  if (k % 2 === 0) return { edges: circulant(n, k / 2, false), extra: null };
  if (n % 2 === 0) return { edges: circulant(n, (k - 1) / 2, true), extra: null };
  // N y k impares: (k+1)-regular menos un emparejamiento casi perfecto de
  // aristas i,i+1 → todos quedan en k salvo la última pareja (k+1).
  const removed = new Set<string>();
  for (let i = 0; i + 1 < n - 1; i += 2) removed.add(key(i, i + 1));
  const edges = circulant(n, (k + 1) / 2, false).filter(([a, b]) => !removed.has(key(a, b)));
  return { edges, extra: n - 1 };
}

/**
 * Americano con partidos garantizados: todas las parejas llegan al mínimo,
 * sin repetir rival mientras haya cruces nuevos. 16 parejas / 3 garantizados
 * → 24 partidos, no 120. Determinístico.
 */
export function buildAmericanoPairings(teamCount: number, guaranteed: number): AmericanoPairings | null {
  if (!Number.isInteger(teamCount) || !Number.isInteger(guaranteed) || teamCount < 2 || guaranteed < 1) return null;

  const full = Math.floor(guaranteed / (teamCount - 1));
  const rest = guaranteed % (teamCount - 1);
  const edges: Array<[number, number]> = [];
  for (let r = 0; r < full; r++) edges.push(...circulant(teamCount, Math.floor((teamCount - 1) / 2), teamCount % 2 === 0));
  let extra: number | null = null;
  if (rest > 0) {
    const partial = nearRegular(teamCount, rest);
    edges.push(...partial.edges);
    extra = partial.extra;
  }

  const matches = edges.map(([a, b]) => (a < b ? [a, b] : [b, a]) as [number, number]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const matchesPerTeam = new Array<number>(teamCount).fill(0);
  for (const [a, b] of matches) {
    matchesPerTeam[a]++;
    matchesPerTeam[b]++;
  }
  return { matches, matchesPerTeam, extraMatchTeam: extra, repeatsOpponents: full >= 1 && guaranteed > teamCount - 1 };
}

/** Cantidad de partidos del americano sin generarlo: ceil(N·k/2). */
export function americanoMatchCount(teamCount: number, guaranteed: number): number {
  if (teamCount < 2 || guaranteed < 1) return 0;
  return Math.ceil((teamCount * guaranteed) / 2);
}
