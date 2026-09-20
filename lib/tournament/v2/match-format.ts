import type { MatchFormat, TournamentFormats } from "./types";
import { formatForPhase } from "./capacity";

/**
 * Default operacional cuando el torneo todavía no configuró `match_formats`
 * (hoy no existe UI para eso — ver reporte de Fase C). No es una regla
 * deportiva inventada, es el fallback más neutro posible: 90 minutos por
 * tiempo, igual para todas las fases.
 */
export const DEFAULT_MATCH_FORMAT: MatchFormat = { kind: "timed", minutes: 90 };
export const DEFAULT_TOURNAMENT_FORMATS: TournamentFormats = { default: DEFAULT_MATCH_FORMAT };

function isMatchFormat(v: unknown): v is MatchFormat {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.kind === "timed") return typeof o.minutes === "number";
  if (o.kind === "sets") return typeof o.bestOf === "number" && typeof o.gamesPerSet === "number" && typeof o.slotMinutes === "number";
  return false;
}

/** Parsea `tournaments.match_formats` (jsonb, puede ser null/inválido) a un TournamentFormats seguro. */
export function resolveTournamentFormats(raw: unknown): TournamentFormats {
  if (!raw || typeof raw !== "object") return DEFAULT_TOURNAMENT_FORMATS;
  const o = raw as Record<string, unknown>;
  if (!isMatchFormat(o.default)) return DEFAULT_TOURNAMENT_FORMATS;
  const result: TournamentFormats = { default: o.default };
  if (isMatchFormat(o.zone)) result.zone = o.zone;
  if (isMatchFormat(o.knockout)) result.knockout = o.knockout;
  if (isMatchFormat(o.final)) result.final = o.final;
  return result;
}

export type MatchPhaseForFormat = "zone" | "knockout" | "americano" | "americano_final" | "pena";

/** Formato aplicable a un partido concreto según su fase (y si es la final del cuadro). */
export function pickMatchFormat(formats: TournamentFormats, phase: MatchPhaseForFormat, isFinal: boolean): MatchFormat {
  if (phase === "zone") return formatForPhase(formats, "zone");
  if (phase === "knockout") return formatForPhase(formats, isFinal ? "final" : "knockout");
  // americano / americano_final / pena: sin override propio hoy, usan el default del torneo.
  return formats.default;
}
