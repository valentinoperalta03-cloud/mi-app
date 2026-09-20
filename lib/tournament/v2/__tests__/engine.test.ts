import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAmericanoPairings, americanoMatchCount } from "../americano";
import { bracketSeedOrder, buildSeededEliminationFixture, buildSeededFirstRound, type SeededEntry } from "../bracket";
import { americanoLoads, computeCapacity, eliminationStructure, formatMinutes, penaStructure, registrationCapacity, zonasLoads } from "../capacity";
import { checkPairForCategory, checkPlayerForCategory, parseCategoryLevel, validateSumaTarget } from "../categories";
import {
  structuralFieldsChanged,
  validateCategoryInput,
  validateCategoryInputs,
  validateMaxPairsChange,
  type CategoryInput,
} from "../category-input";
import { categoryInputToRow } from "../category-row";
import { knockoutMatchCount, playoffSizeOptions, qualificationPlan } from "../playoff";
import { selectQualifiers } from "../qualifiers";
import { pickMatchFormat, resolveTournamentFormats } from "../match-format";
import { validateMatchResult } from "../results";
import { compareAcrossZones, computeAmericanoStandings, computeZoneStandings, type StandingRow } from "../standings";
import { defaultSetsFormat, type ScoredMatch, type SetsFormat, type TournamentFormats } from "../types";
import { distributeZones, evaluateZones, roundRobinMatchCount, totalZoneMatches, zoneName } from "../zones";

const P = (level: number | null, gender: string | null = "masculino") => ({ level, gender });

describe("zonas", () => {
  it("distribuye parejo con diferencia máxima 1", () => {
    assert.deepEqual(distributeZones(14, 3), [5, 5, 4]);
    assert.deepEqual(distributeZones(14, 4), [4, 4, 3, 3]);
    assert.deepEqual(distributeZones(17, 4), [5, 4, 4, 4]);
    assert.equal(distributeZones(5, 3), null);
  });

  it("valida partidos garantizados con la zona más chica", () => {
    const ok = evaluateZones(14, 3, 3);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.minMatchesPerPair, 3);
      assert.equal(ok.maxMatchesPerPair, 4);
      assert.equal(ok.totalMatches, 26);
    }
    const bad = evaluateZones(14, 4, 3);
    assert.equal(bad.ok, false);
    assert.equal(bad.minMatchesPerPair, 2);
    assert.match(bad.ok ? "" : bad.message, /solo 2 partidos/);
  });

  it("usa combinatoria real", () => {
    assert.equal(roundRobinMatchCount(5), 10);
    assert.equal(roundRobinMatchCount(4), 6);
    assert.equal(totalZoneMatches([5, 5, 4]), 26);
  });

  it("nombra zonas", () => {
    assert.equal(zoneName(0), "A");
    assert.equal(zoneName(2), "C");
    assert.equal(zoneName(26), "AA");
  });
});

describe("playoff", () => {
  it("ofrece solo llaves limpias coherentes", () => {
    assert.deepEqual(playoffSizeOptions(14, 3), [4, 8]);
    assert.deepEqual(playoffSizeOptions(16, 4), [4, 8, 16]);
    assert.equal(knockoutMatchCount(8), 7);
  });

  it("3 zonas / llave 8 → 1° y 2° + 2 mejores 3°", () => {
    const plan = qualificationPlan([5, 5, 4], 8);
    assert.equal(plan.ok, true);
    if (plan.ok) {
      assert.deepEqual(plan.levels.map((l) => [l.position, l.all, l.takes]), [[1, true, 3], [2, true, 3], [3, false, 2]]);
      assert.equal(plan.description, "1° y 2° de cada zona + los 2 mejores 3°");
    }
  });

  it("3 zonas / llave 4 → 1° + mejor 2°", () => {
    const plan = qualificationPlan([5, 5, 4], 4);
    assert.equal(plan.ok && plan.description, "1° de cada zona + el mejor 2°");
  });

  it("rechaza llaves con menos plazas que zonas o más que parejas", () => {
    assert.equal(qualificationPlan([5, 5, 4], 2).ok, false);
    assert.equal(qualificationPlan([5, 5, 4], 16).ok, false);
  });
});

describe("capacidad", () => {
  const f45: TournamentFormats = { default: { kind: "timed", minutes: 45 } };

  it("14 parejas / 3 zonas / llave 8 = 33 partidos", () => {
    const plan = computeCapacity(zonasLoads([5, 5, 4], 8, f45));
    assert.equal(plan.totalMatches, 33);
    assert.equal(plan.totalMinutes, 33 * 45);
    assert.equal(formatMinutes(plan.totalMinutes), "24 h 45 min");
    assert.equal(plan.uniformSlotMinutes, 45);
  });

  it("formatos distintos por fase = 19 h", () => {
    const sets45: SetsFormat = { kind: "sets", bestOf: 1, gamesPerSet: 6, superTiebreakDecider: false, slotMinutes: 45 };
    const sets90: SetsFormat = { kind: "sets", bestOf: 3, gamesPerSet: 6, superTiebreakDecider: true, slotMinutes: 90 };
    const plan = computeCapacity(
      zonasLoads([5, 5, 4], 8, { default: { kind: "timed", minutes: 30 }, knockout: sets45, final: sets90 }),
    );
    assert.deepEqual(plan.phases.map((p) => [p.key, p.matches, p.totalMinutes]), [["zone", 26, 780], ["knockout", 6, 270], ["final", 1, 90]]);
    assert.equal(formatMinutes(plan.totalMinutes), "19 h");
    assert.equal(plan.uniformSlotMinutes, null);
  });

  it("eliminación garantiza 1 partido, 2 con Copa de Plata", () => {
    assert.deepEqual(eliminationStructure(8, false), { goldMatches: 7, silverMatches: 0, guaranteedMatches: 1 });
    assert.deepEqual(eliminationStructure(8, true), { goldMatches: 7, silverMatches: 3, guaranteedMatches: 2 });
    assert.equal(eliminationStructure(6, false), null);
  });

  it("americano usa partidos reales y no todos contra todos", () => {
    const plan = computeCapacity(americanoLoads(16, 3, true, f45));
    assert.equal(plan.totalMatches, 24 + 2);
  });

  it("peña: parejas impares dejan una sin partido", () => {
    assert.deepEqual(penaStructure(6), { pairs: 3, matches: 1, pairWithoutMatch: true });
  });
});

describe("categorías", () => {
  it("parsea categorías de perfil", () => {
    assert.equal(parseCategoryLevel("8va"), 8);
    assert.equal(parseCategoryLevel("7ma · Iniciación"), 7);
    assert.equal(parseCategoryLevel(null), null);
    assert.equal(parseCategoryLevel("octava"), null);
  });

  it("suma exacta", () => {
    const suma15 = { kind: "suma" as const, modality: null, sumaTarget: 15 };
    assert.equal(checkPairForCategory(suma15, P(8), P(7)).ok, true);
    assert.equal(checkPairForCategory(suma15, P(7), P(7)).ok, false);
    const suma14 = { kind: "suma" as const, modality: null, sumaTarget: 14 };
    assert.equal(checkPairForCategory(suma14, P(7), P(7)).ok, true);
    assert.equal(checkPairForCategory(suma14, P(6), P(8)).ok, true);
    assert.equal(checkPairForCategory(suma14, P(8), P(null)).ok, false);
  });

  it("suma mayor a 16 inválida", () => {
    assert.equal(validateSumaTarget(17).ok, false);
    assert.equal(validateSumaTarget(16).ok, true);
    assert.equal(checkPairForCategory({ kind: "suma", modality: null, sumaTarget: 17 }, P(8), P(8)).ok, false);
  });

  it("jugador solo en suma: tiene que existir un compañero posible", () => {
    const suma10 = { kind: "suma" as const, modality: null, sumaTarget: 10 };
    assert.equal(checkPlayerForCategory(suma10, P(2)).ok, true);
    assert.equal(checkPlayerForCategory(suma10, P(1)).ok, false);
  });

  it("tradicional y modalidad", () => {
    const octavaCab = { kind: "traditional" as const, modality: "caballeros" as const, levels: [8] };
    assert.equal(checkPairForCategory(octavaCab, P(8), P(8)).ok, true);
    assert.equal(checkPairForCategory(octavaCab, P(8), P(7)).ok, false);
    assert.equal(checkPairForCategory(octavaCab, P(8), P(8, "femenino")).ok, false);
    const mixto = { kind: "open" as const, modality: "mixto" as const };
    assert.equal(checkPairForCategory(mixto, P(8), P(8, "femenino")).ok, true);
    assert.equal(checkPairForCategory(mixto, P(8), P(8)).ok, false);
    assert.equal(checkPairForCategory(mixto, P(8), P(8, null)).ok, false);
  });

  it("tradicional con varios niveles permitidos: allowed_levels IN, sin jerarquía (decisión final)", () => {
    // Torneo 7ma+8va: allowed_levels = [7, 8]. 7ma y 8va válidos; 6ta y 5ta no,
    // aunque 6ta "sea más baja" que 7ma — no se infiere ninguna jerarquía.
    const rule = { kind: "traditional" as const, modality: null, levels: [7, 8] };
    assert.equal(checkPairForCategory(rule, P(7), P(8)).ok, true);
    assert.equal(checkPairForCategory(rule, P(8), P(8)).ok, true);
    assert.equal(checkPairForCategory(rule, P(7), P(6)).ok, false);
    assert.equal(checkPairForCategory(rule, P(6), P(5)).ok, false);
  });

  it("mixto + suma: composición hombre/mujer Y suma exacta", () => {
    const mixtoSuma15 = { kind: "suma" as const, modality: "mixto" as const, sumaTarget: 15 };
    assert.equal(checkPairForCategory(mixtoSuma15, P(8), P(7, "femenino")).ok, true);
    // Suma correcta pero mismo género: falla por modalidad.
    assert.equal(checkPairForCategory(mixtoSuma15, P(8), P(7)).ok, false);
    // Modalidad correcta pero suma incorrecta.
    assert.equal(checkPairForCategory(mixtoSuma15, P(7), P(7, "femenino")).ok, false);
  });
});

function baseCategoryInput(overrides: Partial<CategoryInput> = {}): CategoryInput {
  return {
    name: "8va Caballeros",
    modality: "caballeros",
    categoryKind: "traditional",
    levels: [8],
    maxPairs: 8,
    pricePerPair: 10000,
    priceUnit: "pair",
    requiresDeposit: false,
    acceptsMp: true,
    acceptsCash: false,
    acceptsTransfer: false,
    ...overrides,
  };
}

describe("validación de categoría (wizard Fase B)", () => {
  it("acepta una categoría bien formada", () => {
    assert.equal(validateCategoryInput(baseCategoryInput()).ok, true);
  });

  it("exige nombre, niveles/suma según el tipo, cupo y al menos un método de pago", () => {
    assert.equal(validateCategoryInput(baseCategoryInput({ name: "" })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ levels: [] })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ categoryKind: "suma", sumaTarget: 20 })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ categoryKind: "suma", sumaTarget: 15 })).ok, true);
    assert.equal(validateCategoryInput(baseCategoryInput({ maxPairs: 1 })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ acceptsMp: false, acceptsCash: false, acceptsTransfer: false })).ok, false);
  });

  it("valida la seña igual que el wizard viejo (percentage 1-100, fixed > 0)", () => {
    assert.equal(validateCategoryInput(baseCategoryInput({ requiresDeposit: true, depositType: null })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ requiresDeposit: true, depositType: "percentage", depositValue: 150 })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ requiresDeposit: true, depositType: "fixed", depositValue: 0 })).ok, false);
    assert.equal(validateCategoryInput(baseCategoryInput({ requiresDeposit: true, depositType: "percentage", depositValue: 50 })).ok, true);
  });

  it("una lista de 3 categorías con precio/seña/métodos distintos es válida; nombres duplicados no", () => {
    const three = [
      baseCategoryInput({ name: "8va Caballeros" }),
      baseCategoryInput({ name: "7ma Caballeros", levels: [7], pricePerPair: 15000, requiresDeposit: true, depositType: "fixed", depositValue: 5000 }),
      baseCategoryInput({ name: "Mixto Suma 15", modality: "mixto", categoryKind: "suma", sumaTarget: 15, acceptsMp: false, acceptsTransfer: true }),
    ];
    assert.equal(validateCategoryInputs(three).ok, true);
    assert.equal(validateCategoryInputs([three[0], { ...three[0] }]).ok, false);
    assert.equal(validateCategoryInputs([]).ok, false);
  });

  it("categoryInputToRow no filtra levels/suma_target de un tipo al otro", () => {
    const row = categoryInputToRow("t1", baseCategoryInput({ categoryKind: "suma", sumaTarget: 15, levels: [8] }), 0);
    assert.equal(row.suma_target, 15);
    assert.equal(row.levels, null);
  });
});

describe("proteger ediciones de categoría con inscriptos (Fase B, cierre)", () => {
  it("detecta cambios en modalidad/tipo/niveles/suma; ignora orden de levels", () => {
    const base = { modality: "caballeros" as const, categoryKind: "traditional" as const, levels: [7, 8], sumaTarget: null };
    assert.equal(structuralFieldsChanged(base, { ...base, levels: [8, 7] }), false);
    assert.equal(structuralFieldsChanged(base, { ...base, modality: "damas" }), true);
    assert.equal(structuralFieldsChanged(base, { ...base, categoryKind: "suma", levels: null, sumaTarget: 15 }), true);
    assert.equal(structuralFieldsChanged(base, { ...base, levels: [8] }), true);
  });

  it("precio/seña/métodos de pago NO son estructurales (no bloquean edición)", () => {
    // structuralFieldsChanged ni siquiera recibe esos campos — por diseño no
    // pueden bloquear nada acá; el server action los actualiza siempre.
    const base = { modality: null, categoryKind: "open" as const, levels: null, sumaTarget: null };
    assert.equal(structuralFieldsChanged(base, { ...base }), false);
  });

  it("max_pairs: subir siempre ok, bajar por debajo de inscripciones vivas no", () => {
    assert.equal(validateMaxPairsChange(20, 16).ok, true);
    assert.equal(validateMaxPairsChange(16, 16).ok, true);
    assert.equal(validateMaxPairsChange(10, 16).ok, false);
    assert.equal(validateMaxPairsChange(0, 0).ok, true);
  });
});

describe("cupo", () => {
  it("jugadores buscando compañero no ocupan cupo", () => {
    const c = registrationCapacity(14, 16, 8);
    assert.equal(c.label, "14 / 16");
    assert.equal(c.remaining, 2);
    assert.equal(c.isFull, false);
  });
});

function scored(pair1Id: string, pair2Id: string, s1: number, s2: number, g1: number, g2: number): ScoredMatch {
  return { pair1Id, pair2Id, sets1: s1, sets2: s2, games1: g1, games2: g2, outcome: s1 === s2 && g1 === g2 ? "draw" : s1 > s2 || (s1 === s2 && g1 > g2) ? "pair1" : "pair2" };
}

describe("tabla de zona", () => {
  it("puntos 2/1/0 y desempates por sets, games y games a favor", () => {
    const st = computeZoneStandings(
      ["a", "b", "c"],
      [scored("a", "b", 1, 0, 6, 2), scored("b", "c", 0, 0, 3, 3), scored("a", "c", 0, 1, 4, 6)],
    );
    const byId = Object.fromEntries(st.rows.map((r) => [r.pairId, r]));
    assert.equal(byId.a.points, 2);
    assert.equal(byId.b.points, 1);
    assert.equal(byId.c.points, 3);
    assert.deepEqual(st.rows.map((r) => r.pairId), ["c", "a", "b"]);
    assert.deepEqual(st.unresolvedTies, []);
  });

  it("marca empates exactos sin elegir", () => {
    const st = computeZoneStandings(["a", "b"], [scored("a", "b", 0, 0, 4, 4)]);
    assert.deepEqual(st.unresolvedTies, [["a", "b"]]);
  });
});

function row(pairId: string, played: number, points: number, sf: number, sa: number, gf: number, ga: number): StandingRow {
  return { pairId, played, won: 0, drawn: 0, lost: 0, points, setsFor: sf, setsAgainst: sa, gamesFor: gf, gamesAgainst: ga, setDiff: sf - sa, gameDiff: gf - ga };
}

describe("comparación entre zonas", () => {
  it("normaliza por partidos jugados, no por puntos brutos", () => {
    // 4 pts en 4 partidos (50%) vs 4 pts en 3 partidos (66%): va primero el segundo.
    const bigZone = row("x", 4, 4, 2, 2, 20, 20);
    const smallZone = row("y", 3, 4, 2, 1, 15, 14);
    assert.ok(compareAcrossZones(smallZone, bigZone) < 0);
  });

  it("usa % de sets, % de games y dif. de games por partido en ese orden", () => {
    const a = row("a", 2, 2, 1, 1, 10, 8);
    const b = row("b", 4, 4, 2, 2, 20, 18);
    // Mismo % de puntos y sets, mismo % de games (10/18 vs 20/38 no son iguales).
    assert.notEqual(compareAcrossZones(a, b), 0);
    const c = row("c", 2, 2, 1, 1, 10, 10);
    const d = row("d", 4, 4, 2, 2, 20, 20);
    assert.equal(compareAcrossZones(c, d), 0);
  });

  it("partidos por tiempo (sin sets) saltean el criterio de sets", () => {
    const a = row("a", 3, 4, 0, 0, 20, 10);
    const b = row("b", 3, 4, 0, 0, 20, 15);
    assert.ok(compareAcrossZones(a, b) < 0);
  });
});

describe("clasificados", () => {
  function zone(zoneId: string, ids: string[], rows: StandingRow[]) {
    return { zoneId, standings: { rows: ids.map((id) => rows.find((r) => r.pairId === id)!), unresolvedTies: [] as string[][] } };
  }

  it("elige mejores terceros normalizando zonas desiguales", () => {
    const zA = zone("A", ["a1", "a2", "a3", "a4", "a5"], [
      row("a1", 4, 8, 4, 0, 24, 5), row("a2", 4, 6, 3, 1, 20, 10), row("a3", 4, 4, 2, 2, 15, 15), row("a4", 4, 2, 1, 3, 10, 20), row("a5", 4, 0, 0, 4, 5, 24),
    ]);
    const zB = zone("B", ["b1", "b2", "b3", "b4", "b5"], [
      row("b1", 4, 8, 4, 0, 24, 6), row("b2", 4, 6, 3, 1, 19, 10), row("b3", 4, 2, 1, 3, 12, 18), row("b4", 4, 2, 1, 3, 11, 19), row("b5", 4, 2, 1, 3, 10, 20),
    ]);
    const zC = zone("C", ["c1", "c2", "c3", "c4"], [
      row("c1", 3, 6, 3, 0, 18, 4), row("c2", 3, 4, 2, 1, 14, 10), row("c3", 3, 2, 1, 2, 11, 13), row("c4", 3, 0, 0, 3, 5, 18),
    ]);
    const res = selectQualifiers([zA, zB, zC], 8);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.deepEqual(res.qualifiers.map((q) => q.pairId).slice(6), ["a3", "c3"]);
      assert.equal(res.qualifiers.length, 8);
    }
  });

  it("empate exacto por la última plaza queda pendiente", () => {
    const zA = zone("A", ["a1", "a2"], [row("a1", 1, 2, 1, 0, 6, 3), row("a2", 1, 0, 0, 1, 3, 6)]);
    const zB = zone("B", ["b1", "b2"], [row("b1", 1, 2, 1, 0, 6, 2), row("b2", 1, 0, 0, 1, 3, 6)]);
    const zC = zone("C", ["c1", "c2"], [row("c1", 1, 2, 1, 0, 6, 1), row("c2", 1, 0, 0, 1, 3, 6)]);
    const res = selectQualifiers([zA, zB, zC], 4);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.pending[0].kind, "qualification");
  });

  it("empate exacto que solo afecta el ORDEN de siembra se resuelve solo, por orden de zona", () => {
    // Llave de 4, 4 zonas de 1° cada una: los 4 primeros clasifican todos
    // (level.all = true), así que un empate exacto entre ellos no bloquea —
    // se ordena por zona (A antes que B antes que C antes que D).
    const zA = zone("A", ["a1"], [row("a1", 1, 2, 1, 0, 6, 0)]);
    const zB = zone("B", ["b1"], [row("b1", 1, 2, 1, 0, 6, 0)]);
    const zC = zone("C", ["c1"], [row("c1", 1, 2, 1, 0, 6, 0)]);
    const zD = zone("D", ["d1"], [row("d1", 1, 2, 1, 0, 6, 0)]);
    const res = selectQualifiers([zA, zB, zC, zD], 4);
    assert.equal(res.ok, true);
    if (res.ok) assert.deepEqual(res.qualifiers.map((q) => q.pairId), ["a1", "b1", "c1", "d1"]);
  });
});

describe("llave", () => {
  it("orden estándar de siembra", () => {
    assert.deepEqual(bracketSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("llave de 2 (final directa) es una opción válida", () => {
    assert.deepEqual(playoffSizeOptions(2, 1), [2]);
    assert.equal(knockoutMatchCount(2), 1);
    const b = buildSeededFirstRound([{ seed: 1, pairId: "p1", zoneId: "A" }, { seed: 2, pairId: "p2", zoneId: "A" }]);
    assert.equal(b.ok, true);
    if (b.ok) assert.deepEqual(b.matches.map((m) => [m.high.pairId, m.low.pairId]), [["p1", "p2"]]);
  });

  it("mejor vs peor cuando no hay conflictos de zona", () => {
    const entries: SeededEntry[] = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ seed: s, pairId: `p${s}`, zoneId: `z${s}` }));
    const b = buildSeededFirstRound(entries);
    assert.equal(b.ok, true);
    if (b.ok) assert.deepEqual(b.matches.map((m) => [m.high.seed, m.low.seed]), [[1, 8], [4, 5], [2, 7], [3, 6]]);
  });

  it("evita misma zona en primera ronda cuando es posible", () => {
    // 1°A,1°B,1°C,2°B | 2°A,2°C,3°A,3°C → ideal 1v8 (A vs C ok), 2v7 (B vs A ok), 3v6 (C vs C!), 4v5 (B vs A ok)
    const zones = ["A", "B", "C", "B", "A", "C", "A", "C"];
    const entries: SeededEntry[] = zones.map((z, i) => ({ seed: i + 1, pairId: `p${i + 1}`, zoneId: z }));
    const b = buildSeededFirstRound(entries);
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.sameZoneCount, 0);
      assert.equal(b.explanation, null);
      for (const m of b.matches) assert.notEqual(m.high.zoneId, m.low.zoneId);
      assert.equal(new Set(b.matches.flatMap((m) => [m.high.seed, m.low.seed])).size, 8);
    }
  });

  it("si es imposible lo permite y lo explica", () => {
    const entries: SeededEntry[] = [1, 2, 3, 4].map((s) => ({ seed: s, pairId: `p${s}`, zoneId: s === 4 ? "B" : "A" }));
    const b = buildSeededFirstRound(entries);
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.sameZoneCount, 1);
      assert.ok(b.explanation);
    }
  });

  function seededEntries(n: number): SeededEntry[] {
    return Array.from({ length: n }, (_, i) => ({ seed: i + 1, pairId: `p${i + 1}`, zoneId: `z${i + 1}` }));
  }

  it("cuadro completo: 2 clasificados → solo la final", () => {
    const f = buildSeededEliminationFixture(seededEntries(2));
    assert.equal(f.ok, true);
    if (f.ok) {
      assert.equal(f.rows.length, 1);
      assert.deepEqual([f.rows[0].round, f.rows[0].roundName, f.rows[0].pair1Id, f.rows[0].pair2Id], [1, "Final", "p1", "p2"]);
    }
  });

  it("cuadro completo: 4 clasificados → semis + final encadenadas", () => {
    const f = buildSeededEliminationFixture(seededEntries(4));
    assert.equal(f.ok, true);
    if (f.ok) {
      assert.equal(f.rows.length, 3);
      const semis = f.rows.filter((r) => r.round === 1);
      const final = f.rows.find((r) => r.round === 2)!;
      assert.equal(semis.length, 2);
      assert.equal(final.roundName, "Final");
      assert.deepEqual([final.feederLeftMatchId, final.feederRightMatchId].sort(), semis.map((s) => s.id).sort());
      assert.equal(final.pair1Id, null);
    }
  });

  it("cuadro completo: 8 clasificados → cuartos + semis + final, sin duplicar IDs", () => {
    const f = buildSeededEliminationFixture(seededEntries(8));
    assert.equal(f.ok, true);
    if (f.ok) {
      assert.equal(f.rows.length, 7);
      assert.deepEqual(f.rows.filter((r) => r.round === 1).map((r) => r.roundName).length, 4);
      assert.equal(f.rows.filter((r) => r.round === 2).length, 2);
      assert.equal(f.rows.filter((r) => r.round === 3).length, 1);
      assert.equal(new Set(f.rows.map((r) => r.id)).size, 7);
      // Cada partido de ronda 2+ referencia exactamente dos partidos de la ronda anterior, sin huecos.
      for (const r of f.rows.filter((x) => x.round > 1)) {
        assert.ok(f.rows.some((x) => x.id === r.feederLeftMatchId && x.round === r.round - 1));
        assert.ok(f.rows.some((x) => x.id === r.feederRightMatchId && x.round === r.round - 1));
      }
    }
  });
});

describe("resultados", () => {
  const timed = { kind: "timed" as const, minutes: 30 };
  const bo3: SetsFormat = { kind: "sets", bestOf: 3, gamesPerSet: 6, superTiebreakDecider: true, slotMinutes: 90 };

  it("por tiempo: empate permitido en zonas", () => {
    const r = validateMatchResult(timed, "zone", { kind: "timed", games1: 5, games2: 5 });
    assert.equal(r.ok && r.result.outcome, "draw");
  });

  it("por tiempo: empate bloqueado en eliminación salvo desempate explícito", () => {
    assert.equal(validateMatchResult(timed, "knockout", { kind: "timed", games1: 5, games2: 5 }).ok, false);
    const r = validateMatchResult(timed, "knockout", { kind: "timed", games1: 5, games2: 5, tiebreakWinner: 2 });
    assert.equal(r.ok && r.result.outcome, "pair2");
  });

  it("sets: acepta resultados válidos y super tie-break", () => {
    const r = validateMatchResult(bo3, "knockout", { kind: "sets", sets: [{ p1: 6, p2: 4 }, { p1: 3, p2: 6 }, { p1: 10, p2: 7 }] });
    assert.equal(r.ok, true);
    // El STB define el set (2-1) pero sus puntos no son games: 6+3=9 vs 4+6=10, no 11-10.
    if (r.ok) assert.deepEqual([r.result.outcome, r.result.sets1, r.result.sets2, r.result.games1, r.result.games2], ["pair1", 2, 1, 9, 10]);
    assert.equal(validateMatchResult(bo3, "zone", { kind: "sets", sets: [{ p1: 7, p2: 6 }, { p1: 7, p2: 5 }] }).ok, true);
  });

  it("por tiempo: el americano también admite empate", () => {
    const r = validateMatchResult(timed, "americano", { kind: "timed", games1: 4, games2: 4 });
    assert.equal(r.ok && r.result.outcome, "draw");
  });

  it("sets: rechaza imposibles, sets de más, incompletos y ganador incoherente", () => {
    assert.equal(validateMatchResult(bo3, "zone", { kind: "sets", sets: [{ p1: 6, p2: 5 }, { p1: 6, p2: 0 }] }).ok, false);
    assert.equal(validateMatchResult(bo3, "zone", { kind: "sets", sets: [{ p1: 6, p2: 0 }, { p1: 6, p2: 0 }, { p1: 10, p2: 2 }] }).ok, false);
    assert.equal(validateMatchResult(bo3, "zone", { kind: "sets", sets: [{ p1: 6, p2: 0 }] }).ok, false);
    assert.equal(validateMatchResult(bo3, "zone", { kind: "sets", sets: [{ p1: 6, p2: 0 }, { p1: 6, p2: 1 }] }, 2).ok, false);
    assert.equal(validateMatchResult(bo3, "zone", { kind: "timed", games1: 3, games2: 1 }).ok, false);
  });
});

describe("ranking del americano", () => {
  it("con todos igual cantidad de partidos usa el criterio normal", () => {
    const st = computeAmericanoStandings(
      ["a", "b"],
      [scored("a", "b", 1, 0, 6, 2)],
      true,
    );
    assert.deepEqual(st.rows.map((r) => r.pairId), ["a", "b"]);
  });

  it("si una pareja jugó un partido de más, normaliza en vez de comparar puntos brutos", () => {
    // a jugó 3 (6 pts, 66%), b jugó 2 (4 pts, 100%): con puntos brutos a
    // parecería mejor, pero normalizado b va primero.
    const st = computeAmericanoStandings(
      ["a", "b", "c", "d"],
      [
        scored("a", "c", 1, 0, 6, 2),
        scored("a", "d", 1, 0, 6, 2),
        scored("a", "b", 0, 1, 2, 6),
        scored("b", "c", 1, 0, 6, 1),
      ],
      false,
    );
    const byId = Object.fromEntries(st.rows.map((r, i) => [r.pairId, i]));
    assert.ok(byId.b < byId.a, "b (100% en 2 partidos) debe ir antes que a (66% en 3)");
  });

  it("default de formato de sets: 1 set a 6 sin STB decider; mejor de 3 con STB a 10", () => {
    assert.deepEqual(defaultSetsFormat(1, 45), { kind: "sets", bestOf: 1, gamesPerSet: 6, superTiebreakDecider: false, slotMinutes: 45 });
    assert.deepEqual(defaultSetsFormat(3, 90), { kind: "sets", bestOf: 3, gamesPerSet: 6, superTiebreakDecider: true, slotMinutes: 90 });
  });
});

describe("resolución de formato por fase (Fase C)", () => {
  it("sin match_formats configurado, usa el default operacional (90 min)", () => {
    const formats = resolveTournamentFormats(null);
    assert.deepEqual(formats.default, { kind: "timed", minutes: 90 });
    assert.deepEqual(pickMatchFormat(formats, "zone", false), { kind: "timed", minutes: 90 });
    assert.deepEqual(pickMatchFormat(formats, "knockout", true), { kind: "timed", minutes: 90 });
  });

  it("con match_formats configurado, usa el override de cada fase y cae al default para americano", () => {
    const raw = {
      default: { kind: "timed", minutes: 30 },
      knockout: { kind: "sets", bestOf: 1, gamesPerSet: 6, superTiebreakDecider: false, slotMinutes: 45 },
      final: { kind: "sets", bestOf: 3, gamesPerSet: 6, superTiebreakDecider: true, slotMinutes: 90 },
    };
    const formats = resolveTournamentFormats(raw);
    assert.deepEqual(pickMatchFormat(formats, "knockout", false), raw.knockout);
    assert.deepEqual(pickMatchFormat(formats, "knockout", true), raw.final);
    assert.deepEqual(pickMatchFormat(formats, "americano", false), raw.default);
  });

  it("match_formats corrupto/incompleto cae al default sin romper", () => {
    assert.deepEqual(resolveTournamentFormats({ zone: "no un formato" }), { default: { kind: "timed", minutes: 90 } });
    assert.deepEqual(resolveTournamentFormats("no es un objeto"), { default: { kind: "timed", minutes: 90 } });
  });
});

describe("americano con garantizados", () => {
  function check(n: number, k: number) {
    const res = buildAmericanoPairings(n, k)!;
    const seen = new Set(res.matches.map(([a, b]) => `${a}-${b}`));
    return { res, noRepeats: seen.size === res.matches.length };
  }

  it("16 parejas / 3 garantizados = 24 partidos sin repetir", () => {
    const { res, noRepeats } = check(16, 3);
    assert.equal(res.matches.length, 24);
    assert.equal(americanoMatchCount(16, 3), 24);
    assert.ok(noRepeats);
    assert.ok(res.matchesPerTeam.every((m) => m === 3));
    assert.equal(res.extraMatchTeam, null);
  });

  it("N × garantizados impar: una sola pareja con un partido extra", () => {
    for (const [n, k] of [[5, 3], [7, 3], [9, 5], [3, 1], [11, 7]]) {
      const { res, noRepeats } = check(n, k);
      assert.ok(noRepeats, `${n}/${k} repite`);
      assert.equal(res.matchesPerTeam.filter((m) => m === k + 1).length, 1, `${n}/${k}`);
      assert.ok(res.matchesPerTeam.every((m) => m === k || m === k + 1));
      assert.equal(res.matches.length, americanoMatchCount(n, k));
    }
  });

  it("todos llegan al mínimo en varios tamaños sin repetir rivales", () => {
    for (let n = 2; n <= 20; n++) {
      for (let k = 1; k < n; k++) {
        const { res, noRepeats } = check(n, k);
        assert.ok(noRepeats, `${n}/${k}`);
        assert.ok(res.matchesPerTeam.every((m) => m >= k && m <= k + 1), `${n}/${k}`);
        assert.equal(res.matches.length, americanoMatchCount(n, k), `${n}/${k}`);
      }
    }
  });
});
