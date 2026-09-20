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

/**
 * Convierte el formato "legacy" del wizard (`tournaments.match_format`:
 * 'set' | 'tres_sets' | 'tiempo', + `match_duration_minutes`) al MatchFormat
 * real que usa `validateMatchResult`. Es el único lugar donde vive esta
 * conversión — todo el resto del motor de resultados solo conoce MatchFormat.
 */
export function legacyMatchFormatToV2(
  matchFormat: string | null | undefined,
  matchDurationMinutes: number | null | undefined,
): MatchFormat {
  if (matchFormat === "tiempo") {
    return { kind: "timed", minutes: matchDurationMinutes && matchDurationMinutes > 0 ? matchDurationMinutes : 90 };
  }
  if (matchFormat === "tres_sets") {
    return { kind: "sets", bestOf: 3, gamesPerSet: 6, superTiebreakDecider: true, slotMinutes: 90 };
  }
  // 'set' (o cualquier valor legacy desconocido): a un set, sin super tie-break.
  return { kind: "sets", bestOf: 1, gamesPerSet: 6, superTiebreakDecider: false, slotMinutes: 60 };
}

/**
 * Parsea `tournaments.match_formats` (jsonb, puede ser null/inválido) a un
 * TournamentFormats seguro. Si no hay jsonb configurado (hoy ningún wizard lo
 * escribe todavía) cae al formato legacy del torneo (`match_format` +
 * `match_duration_minutes`) en vez de un default de 90 minutos por tiempo
 * fijo — así un torneo creado "al mejor de 3 sets" valida sets reales, no
 * games por tiempo.
 */
export function resolveTournamentFormats(
  raw: unknown,
  legacyMatchFormat?: string | null,
  legacyMatchDurationMinutes?: number | null,
): TournamentFormats {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (isMatchFormat(o.default)) {
      const result: TournamentFormats = { default: o.default };
      if (isMatchFormat(o.zone)) result.zone = o.zone;
      if (isMatchFormat(o.knockout)) result.knockout = o.knockout;
      if (isMatchFormat(o.final)) result.final = o.final;
      return result;
    }
  }
  if (legacyMatchFormat) {
    return { default: legacyMatchFormatToV2(legacyMatchFormat, legacyMatchDurationMinutes) };
  }
  return DEFAULT_TOURNAMENT_FORMATS;
}

export type MatchPhaseForFormat = "zone" | "knockout" | "americano" | "americano_final" | "pena";

/** Formato aplicable a un partido concreto según su fase (y si es la final del cuadro). */
export function pickMatchFormat(formats: TournamentFormats, phase: MatchPhaseForFormat, isFinal: boolean): MatchFormat {
  if (phase === "zone") return formatForPhase(formats, "zone");
  if (phase === "knockout") return formatForPhase(formats, isFinal ? "final" : "knockout");
  // americano / americano_final / pena: sin override propio hoy, usan el default del torneo.
  return formats.default;
}
