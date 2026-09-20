import { americanoMatchCount } from "./americano";
import { knockoutMatchCount } from "./playoff";
import { slotMinutesForFormat } from "./results";
import type { MatchFormat, TournamentFormats } from "./types";
import { totalZoneMatches } from "./zones";

export type PhaseLoad = {
  key: "zone" | "americano" | "americano_final" | "knockout" | "final" | "silver" | "pena";
  label: string;
  matches: number;
  minutesPerMatch: number;
};

export type CapacityPlan = {
  phases: Array<PhaseLoad & { totalMinutes: number }>;
  totalMatches: number;
  totalMinutes: number;
  /** Si todos los partidos ocupan lo mismo, los slots se pueden contar como "espacios". */
  uniformSlotMinutes: number | null;
};

export function formatForPhase(formats: TournamentFormats, phase: "zone" | "knockout" | "final"): MatchFormat {
  if (phase === "final") return formats.final ?? formats.knockout ?? formats.default;
  if (phase === "knockout") return formats.knockout ?? formats.default;
  return formats.zone ?? formats.default;
}

export function computeCapacity(loads: PhaseLoad[]): CapacityPlan {
  const phases = loads.filter((l) => l.matches > 0).map((l) => ({ ...l, totalMinutes: l.matches * l.minutesPerMatch }));
  const totalMatches = phases.reduce((a, p) => a + p.matches, 0);
  const totalMinutes = phases.reduce((a, p) => a + p.totalMinutes, 0);
  const durations = new Set(phases.map((p) => p.minutesPerMatch));
  return { phases, totalMatches, totalMinutes, uniformSlotMinutes: durations.size === 1 ? [...durations][0] : null };
}

/** 1485 → "24 h 45 min"; 1140 → "19 h"; 45 → "45 min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Zonas + playoff: la final se separa porque puede tener otro formato. */
export function zonasLoads(zoneSizes: number[], playoffSize: number | null, formats: TournamentFormats): PhaseLoad[] {
  const loads: PhaseLoad[] = [
    { key: "zone", label: "Zonas", matches: totalZoneMatches(zoneSizes), minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "zone")) },
  ];
  const ko = playoffSize ? knockoutMatchCount(playoffSize) : 0;
  if (ko > 1) {
    loads.push({ key: "knockout", label: "Eliminatorias", matches: ko - 1, minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "knockout")) });
  }
  if (ko >= 1) {
    loads.push({ key: "final", label: "Final", matches: 1, minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "final")) });
  }
  return loads;
}

export type EliminationStructure = { goldMatches: number; silverMatches: number; guaranteedMatches: number };

/**
 * Eliminación directa (N potencia de 2). Sin Copa de Plata solo se garantiza
 * 1 partido; con Copa de Plata (N ≥ 4) los perdedores de la 1ra ronda juegan
 * al menos otro.
 */
export function eliminationStructure(pairs: number, consolationBracket: boolean): EliminationStructure | null {
  const gold = knockoutMatchCount(pairs);
  if (gold === 0) return null;
  const hasSilver = consolationBracket && pairs >= 4;
  const silverMatches = hasSilver ? knockoutMatchCount(pairs / 2) : 0;
  return { goldMatches: gold, silverMatches, guaranteedMatches: hasSilver ? 2 : 1 };
}

export function eliminationLoads(pairs: number, consolationBracket: boolean, formats: TournamentFormats): PhaseLoad[] {
  const s = eliminationStructure(pairs, consolationBracket);
  if (!s) return [];
  const ko = slotMinutesForFormat(formatForPhase(formats, "knockout"));
  return [
    { key: "knockout", label: "Eliminatorias", matches: s.goldMatches - 1, minutesPerMatch: ko },
    { key: "final", label: "Final", matches: 1, minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "final")) },
    { key: "silver", label: "Copa de Plata", matches: s.silverMatches, minutesPerMatch: ko },
  ];
}

/** Americano con garantizados + (opcional) final y 3er puesto. */
export function americanoLoads(pairs: number, guaranteed: number, hasFinals: boolean, formats: TournamentFormats): PhaseLoad[] {
  const loads: PhaseLoad[] = [
    { key: "americano", label: "Americano", matches: americanoMatchCount(pairs, guaranteed), minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "zone")) },
  ];
  if (hasFinals && pairs >= 2) {
    loads.push({ key: "americano_final", label: "Final y 3er puesto", matches: pairs >= 4 ? 2 : 1, minutesPerMatch: slotMinutesForFormat(formatForPhase(formats, "final")) });
  }
  return loads;
}

export type PenaStructure = { pairs: number; matches: number; pairWithoutMatch: boolean };

/** Peña: jugadores individuales → parejas por sorteo → una sola ronda. */
export function penaStructure(players: number): PenaStructure {
  const pairs = Math.floor(Math.max(0, players) / 2);
  return { pairs, matches: Math.floor(pairs / 2), pairWithoutMatch: pairs % 2 === 1 };
}

/**
 * Cupo: solo cuentan parejas confirmadas. Los jugadores buscando compañero
 * no ocupan lugar. 14 confirmadas / 16 → "14 / 16".
 */
export function registrationCapacity(confirmedPairs: number, maxPairs: number, seekingPlayers = 0) {
  const used = Math.max(0, confirmedPairs);
  return {
    used,
    max: maxPairs,
    remaining: Math.max(0, maxPairs - used),
    isFull: used >= maxPairs,
    seekingPlayers: Math.max(0, seekingPlayers),
    label: `${used} / ${maxPairs}`,
  };
}
