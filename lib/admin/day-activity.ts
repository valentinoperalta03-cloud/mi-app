import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSlotTime, parseClockToMinutes } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";

/** `court_blocks.reason` de los bloqueos puntuales cargados a mano desde /admin/bloqueos. */
export const REASON_BLOQUEO_MANUAL = "bloqueo_manual";
/** `court_blocks.reason` que genera /admin/clases y el cron de entrenamientos. */
export const REASON_ENTRENAMIENTO = "entrenamiento_externo";
/** `court_blocks.reason` que escriben los torneos. */
export const REASON_TORNEO = "torneo";

/**
 * Marca en `fixed_slot_exceptions.reason` las excepciones creadas por un cierre
 * de día, para distinguirlas de las que carga el dueño a mano ("no viene esta
 * semana"). Hoy nadie la lee: la UI de turnos fijos solo selecciona
 * `fixed_slot_id` y `exception_date`. Queda escrita para que un futuro
 * "reabrir y restaurar turnos fijos" pueda distinguirlas — ver README de la
 * feature: reabrir NO restaura nada en V1.
 */
export const REASON_EXCEPCION_CIERRE = "cierre_de_dia";

const DEFAULT_SLOT_MINUTES = 90;

export type ActivityKind =
  | "reservation"
  | "open_match"
  | "tournament"
  | "practice"
  | "fixed_slot"
  | "external_training"
  | "manual_block"
  | "other_block";

/**
 * Tipos que el dueño tiene que resolver a mano antes de que se pueda cerrar el
 * día. Son los que tienen plata o gente comprometida y cuya cancelación implica
 * decisiones de Mercado Pago / política de cancelación: eso vive en sus propios
 * flujos, no acá.
 */
export const BLOCKING_KINDS: readonly ActivityKind[] = [
  "reservation",
  "open_match",
  "tournament",
  "practice",
] as const;

export const ACTIVITY_COPY: Record<ActivityKind, { singular: string; plural: string; hint: string }> = {
  reservation: {
    singular: "reserva activa",
    plural: "reservas activas",
    hint: "Cancelalas desde Reservas, ahí se resuelve la seña y el reembolso.",
  },
  open_match: {
    singular: "partido abierto",
    plural: "partidos abiertos",
    hint: "Cancelalos desde Reservas para avisarle a los jugadores anotados.",
  },
  tournament: {
    singular: "torneo programado",
    plural: "torneos programados",
    hint: "Resolvelo desde Torneos antes de cerrar el día.",
  },
  practice: {
    singular: "clase con alumnos",
    plural: "clases con alumnos",
    hint: "Resolvelas desde Clases, tienen inscriptos y pagos asociados.",
  },
  fixed_slot: {
    singular: "turno fijo",
    plural: "turnos fijos",
    hint: "Se cancela solo la ocurrencia de esta fecha. La recurrencia sigue activa.",
  },
  external_training: {
    singular: "entrenamiento externo",
    plural: "entrenamientos externos",
    hint: "El horario del profesor no se toca. Al reabrir el día vuelve a aplicar.",
  },
  manual_block: {
    singular: "bloqueo manual",
    plural: "bloqueos manuales",
    hint: "Sigue existiendo aunque cierres el día.",
  },
  other_block: {
    singular: "bloqueo",
    plural: "bloqueos",
    hint: "Sigue existiendo aunque cierres el día.",
  },
};

export type ActivityItem = {
  kind: ActivityKind;
  courtId: string | null;
  courtName: string;
  /** "18:30", o "" cuando la actividad no tiene horario puntual (ej. un torneo sin fixture). */
  time: string;
  /** Minutos desde medianoche. -1 cuando no tiene horario. */
  startMinutes: number;
  endMinutes: number;
  detail: string;
  /** Solo en `fixed_slot`: id de la regla en `fixed_slots`. */
  fixedSlotId?: string;
};

export type DayActivity = {
  date: string;
  alreadyClosed: boolean;
  items: ActivityItem[];
  counts: Record<ActivityKind, number>;
  /** Tipos bloqueantes presentes ese día. Vacío = se puede cerrar. */
  blockers: ActivityKind[];
  canClose: boolean;
  /**
   * Turnos fijos activos de ese día de semana que todavía no tienen excepción
   * para esa fecha — son los que hay que exceptuar al confirmar el cierre.
   */
  fixedSlotIdsWithoutException: string[];
};

type CourtRef = { id: string; name: string | null };

function emptyCounts(): Record<ActivityKind, number> {
  return {
    reservation: 0,
    open_match: 0,
    tournament: 0,
    practice: 0,
    fixed_slot: 0,
    external_training: 0,
    manual_block: 0,
    other_block: 0,
  };
}

function toItem(
  kind: ActivityKind,
  courtId: string | null,
  courtName: string,
  rawTime: string | null | undefined,
  durationMinutes: number,
  detail: string,
  extra?: { fixedSlotId?: string; endClock?: string | null }
): ActivityItem {
  const time = normalizeSlotTime(rawTime);
  const startMinutes = time ? parseClockToMinutes(time) : -1;
  const explicitEnd = extra?.endClock ? parseClockToMinutes(normalizeSlotTime(extra.endClock)) : null;
  const endMinutes =
    startMinutes < 0
      ? -1
      : explicitEnd !== null && explicitEnd > startMinutes
        ? explicitEnd
        : startMinutes + (durationMinutes > 0 ? durationMinutes : DEFAULT_SLOT_MINUTES);
  return { kind, courtId, courtName, time, startMinutes, endMinutes, detail, fixedSlotId: extra?.fixedSlotId };
}

function classifyBlockReason(reason: string | null | undefined): ActivityKind {
  const r = String(reason ?? "").trim().toLowerCase();
  if (r === REASON_ENTRENAMIENTO) return "external_training";
  if (r === REASON_BLOQUEO_MANUAL) return "manual_block";
  if (r === REASON_TORNEO) return "tournament";
  return "other_block";
}

/**
 * Todo lo que ocupa (o va a ocupar) una cancha de UN club en una fecha concreta.
 * El alcance es siempre un único club (`clubId` + sus canchas): analizar los
 * clubes hermanos de un mismo dueño haría que la actividad del club B impidiera
 * cerrar el club A.
 *
 * Lo usan el preview de "cerrar día", la confirmación del
 * cierre y la validación de un bloqueo puntual, así que las tres pantallas
 * nunca pueden discrepar sobre qué hay ese día.
 *
 * Importante: un turno fijo tiene `match_type='reservation'` igual que una
 * reserva normal. Se separan por `es_turno_fijo` porque tienen tratamiento
 * opuesto — la reserva normal bloquea el cierre, el turno fijo se resuelve
 * solo con una excepción de esa fecha.
 */
export async function getDayActivity(
  supabase: SupabaseClient,
  params: { clubId: string; courts: CourtRef[]; date: string }
): Promise<DayActivity> {
  const { clubId, courts, date } = params;
  const courtIds = courts.map((c) => c.id);
  const courtNameById = new Map(courts.map((c) => [c.id, c.name?.trim() || "Cancha"]));
  const nameOf = (id: string | null | undefined) => (id ? courtNameById.get(id) ?? "Cancha" : "Club");

  const items: ActivityItem[] = [];
  const counts = emptyCounts();

  if (!clubId) {
    return {
      date,
      alreadyClosed: false,
      items,
      counts,
      blockers: [],
      canClose: false,
      fixedSlotIdsWithoutException: [],
    };
  }

  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

  const [
    { data: closedRow },
    { data: matchRows },
    { data: blockRows },
    { data: fixedSlotRows },
    { data: trainingRows },
    { data: tournamentRows },
    { data: tournamentMatchRows },
    { data: practiceRows },
  ] = await Promise.all([
    supabase
      .from(DB_TABLES.clubClosedDays)
      .select("id")
      .eq("club_id", clubId)
      .eq("closed_date", date)
      .maybeSingle(),
    courtIds.length
      ? supabase
          .from(DB_TABLES.matches)
          .select(
            "id,court_id,scheduled_time,duration_minutes,match_type,match_status,es_turno_fijo,fixed_slot_id,manual_reference,location_name"
          )
          .in("court_id", courtIds)
          .eq("scheduled_date", date)
          .neq("match_status", "cancelled")
      : Promise.resolve({ data: [] }),
    courtIds.length
      ? supabase
          .from(DB_TABLES.courtBlocks)
          .select("id,court_id,blocked_time,reason")
          .in("court_id", courtIds)
          .eq("blocked_date", date)
      : Promise.resolve({ data: [] }),
    courtIds.length
      ? supabase
          .from(DB_TABLES.fixedSlots)
          .select("id,court_id,start_time,duration_minutes,title")
          .in("court_id", courtIds)
          .eq("is_active", true)
          .eq("day_of_week", dayOfWeek)
      : Promise.resolve({ data: [] }),
    supabase
      .from(DB_TABLES.trainingBlocks)
      .select("id,court_id,title,coach,start_time,end_time")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek),
    supabase
      .from(DB_TABLES.tournaments)
      .select("id,name,start_date,end_date,status")
      .eq("club_id", clubId)
      .lte("start_date", date)
      .gte("end_date", date),
    courtIds.length
      ? supabase
          .from(DB_TABLES.tournamentMatches)
          .select("id,court_id,scheduled_time,tournament_id")
          .in("court_id", courtIds)
          .eq("scheduled_date", date)
      : Promise.resolve({ data: [] }),
    supabase
      .from(DB_TABLES.practiceSessions)
      .select("id,start_time,status,practices!inner(title,court_id,club_id)")
      .eq("session_date", date)
      .eq("practices.club_id", clubId),
  ]);

  // --- Matches: reservas, partidos abiertos y ocurrencias de turno fijo ---
  const fixedSlotIdsWithMatch = new Set<string>();
  for (const raw of (matchRows ?? []) as Array<{
    id: string;
    court_id: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_type: string | null;
    es_turno_fijo: boolean | null;
    fixed_slot_id: string | null;
    manual_reference: string | null;
  }>) {
    const duration = Number(raw.duration_minutes ?? 0) || DEFAULT_SLOT_MINUTES;
    const type = String(raw.match_type ?? "").toLowerCase();
    if (raw.es_turno_fijo && raw.fixed_slot_id) {
      fixedSlotIdsWithMatch.add(raw.fixed_slot_id);
      items.push(
        toItem("fixed_slot", raw.court_id, nameOf(raw.court_id), raw.scheduled_time, duration, "Turno fijo agendado", {
          fixedSlotId: raw.fixed_slot_id,
        })
      );
      counts.fixed_slot++;
      continue;
    }
    // Un match marcado como turno fijo pero sin `fixed_slot_id` no se puede
    // exceptuar (la excepción se guarda contra la regla), así que se trata como
    // reserva: bloquea el cierre en vez de quedar vivo en un día cerrado.
    if (type === "amistoso") {
      items.push(toItem("open_match", raw.court_id, nameOf(raw.court_id), raw.scheduled_time, duration, "Partido abierto"));
      counts.open_match++;
      continue;
    }
    // reservation y el legacy "competitivo" se tratan igual: reserva de cancha.
    items.push(
      toItem(
        "reservation",
        raw.court_id,
        nameOf(raw.court_id),
        raw.scheduled_time,
        duration,
        raw.manual_reference?.trim() || "Reserva de cancha"
      )
    );
    counts.reservation++;
  }

  // --- court_blocks del día ---
  const trainingBlockKeys = new Set<string>();
  for (const raw of (blockRows ?? []) as Array<{
    id: string;
    court_id: string;
    blocked_time: string | null;
    reason: string | null;
  }>) {
    const kind = classifyBlockReason(raw.reason);
    const time = normalizeSlotTime(raw.blocked_time);
    if (kind === "external_training") {
      // Se listan más abajo desde training_blocks (la regla) para no duplicar
      // la recurrencia con cada ocurrencia generada.
      trainingBlockKeys.add(`${raw.court_id}__${time}`);
      continue;
    }
    const detail =
      kind === "tournament"
        ? "Cancha reservada para torneo"
        : kind === "manual_block"
          ? "Bloqueo manual"
          : `Bloqueo (${String(raw.reason ?? "sin motivo").trim() || "sin motivo"})`;
    items.push(toItem(kind, raw.court_id, nameOf(raw.court_id), raw.blocked_time, DEFAULT_SLOT_MINUTES, detail));
    counts[kind]++;
  }

  // --- Turnos fijos: reglas activas de ese día de semana, menos excepciones ---
  const fixedSlots = (fixedSlotRows ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string;
    duration_minutes: number | null;
    title: string | null;
  }>;
  // Se consultan las excepciones de las reglas activas Y de las que tienen un
  // match generado ese día, para no re-procesar una ocurrencia ya exceptuada.
  const lookupSlotIds = Array.from(new Set([...fixedSlots.map((s) => s.id), ...fixedSlotIdsWithMatch]));
  const { data: exceptionRows } = lookupSlotIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlotExceptions)
        .select("fixed_slot_id")
        .in("fixed_slot_id", lookupSlotIds)
        .eq("exception_date", date)
    : { data: [] };
  const exceptedSlotIds = new Set(
    ((exceptionRows ?? []) as Array<{ fixed_slot_id: string }>).map((e) => e.fixed_slot_id)
  );

  // Ocurrencias huérfanas: hay match de turno fijo pero la regla ya no está
  // activa ese día de semana (se desactivó o se movió de día). Igual hay que
  // exceptuarlas, si no sobreviven al cierre ocupando la cancha.
  const orphanSlotIds = [...fixedSlotIdsWithMatch].filter(
    (id) => !exceptedSlotIds.has(id) && !fixedSlots.some((s) => s.id === id)
  );

  const fixedSlotIdsWithoutException: string[] = [...orphanSlotIds];
  for (const slot of fixedSlots) {
    if (exceptedSlotIds.has(slot.id)) continue;
    fixedSlotIdsWithoutException.push(slot.id);
    // Si el match ya fue generado, la ocurrencia ya se contó arriba.
    if (fixedSlotIdsWithMatch.has(slot.id)) continue;
    items.push(
      toItem(
        "fixed_slot",
        slot.court_id,
        nameOf(slot.court_id),
        slot.start_time,
        Number(slot.duration_minutes ?? 0) || DEFAULT_SLOT_MINUTES,
        slot.title?.trim() || "Turno fijo",
        { fixedSlotId: slot.id }
      )
    );
    counts.fixed_slot++;
  }

  // --- Entrenamientos externos: la regla semanal del profesor ---
  for (const raw of (trainingRows ?? []) as Array<{
    id: string;
    court_id: string;
    title: string;
    coach: string | null;
    start_time: string;
    end_time: string;
  }>) {
    items.push(
      toItem(
        "external_training",
        raw.court_id,
        nameOf(raw.court_id),
        raw.start_time,
        DEFAULT_SLOT_MINUTES,
        raw.coach?.trim() || raw.title?.trim() || "Entrenamiento externo",
        { endClock: raw.end_time }
      )
    );
    counts.external_training++;
    trainingBlockKeys.delete(`${raw.court_id}__${normalizeSlotTime(raw.start_time)}`);
  }
  // Entrenamientos puntuales: court_blocks que no matchean ninguna regla activa.
  for (const key of trainingBlockKeys) {
    const [courtId, time] = key.split("__");
    items.push(
      toItem("external_training", courtId, nameOf(courtId), time, DEFAULT_SLOT_MINUTES, "Entrenamiento externo puntual")
    );
    counts.external_training++;
  }

  // --- Torneos ---
  const tournaments = ((tournamentRows ?? []) as Array<{
    id: string;
    name: string;
    status: string | null;
  }>).filter((t) => String(t.status ?? "").toLowerCase() !== "cancelled");
  const tournamentNameById = new Map(tournaments.map((t) => [t.id, t.name]));
  const countedTournamentIds = new Set<string>();
  for (const t of tournaments) {
    countedTournamentIds.add(t.id);
    items.push(toItem("tournament", null, "Club", null, DEFAULT_SLOT_MINUTES, t.name?.trim() || "Torneo"));
    counts.tournament++;
  }
  for (const raw of (tournamentMatchRows ?? []) as Array<{
    id: string;
    court_id: string | null;
    scheduled_time: string | null;
    tournament_id: string;
  }>) {
    // El torneo padre ya se contó; el partido agendado se lista igual porque
    // ocupa una cancha y una hora concretas.
    const label = tournamentNameById.get(raw.tournament_id) ?? "Partido de torneo";
    items.push(
      toItem("tournament", raw.court_id, nameOf(raw.court_id), raw.scheduled_time, DEFAULT_SLOT_MINUTES, label)
    );
    if (!countedTournamentIds.has(raw.tournament_id)) {
      countedTournamentIds.add(raw.tournament_id);
      counts.tournament++;
    }
  }

  // --- Clases con alumnos (practices / practice_sessions) ---
  for (const raw of (practiceRows ?? []) as Array<{
    id: string;
    start_time: string | null;
    status: string | null;
    practices: { title: string | null; court_id: string | null } | Array<{ title: string | null; court_id: string | null }>;
  }>) {
    if (String(raw.status ?? "").toLowerCase() === "cancelled") continue;
    const practice = Array.isArray(raw.practices) ? raw.practices[0] : raw.practices;
    const courtId = practice?.court_id ?? null;
    // Una práctica sin cancha asignada igual pertenece al club: se cuenta.
    if (courtId && !courtNameById.has(courtId)) continue;
    items.push(
      toItem("practice", courtId, nameOf(courtId), raw.start_time, DEFAULT_SLOT_MINUTES, practice?.title?.trim() || "Clase")
    );
    counts.practice++;
  }

  items.sort((a, b) => a.startMinutes - b.startMinutes || a.courtName.localeCompare(b.courtName));

  const blockers = BLOCKING_KINDS.filter((k) => counts[k] > 0);

  return {
    date,
    alreadyClosed: Boolean(closedRow),
    items,
    counts,
    blockers: [...blockers],
    canClose: blockers.length === 0,
    fixedSlotIdsWithoutException,
  };
}

export type SlotOccupancy = { occupied: boolean; kind: ActivityKind | null; detail: string };

/**
 * ¿Hay algo ocupando ese turno en esa cancha? Cualquier solapamiento cuenta,
 * no solo un inicio exacto: un entrenamiento de 19:30 a 21:00 ocupa el turno
 * de las 20:00 aunque no arranque ahí.
 */
export function findSlotOccupancy(
  activity: DayActivity,
  courtId: string,
  slotTime: string,
  slotMinutes = DEFAULT_SLOT_MINUTES
): SlotOccupancy {
  const start = parseClockToMinutes(normalizeSlotTime(slotTime));
  const end = start + slotMinutes;
  for (const item of activity.items) {
    if (item.courtId !== courtId) continue;
    if (item.startMinutes < 0) continue;
    if (item.startMinutes < end && item.endMinutes > start) {
      return { occupied: true, kind: item.kind, detail: item.detail };
    }
  }
  return { occupied: false, kind: null, detail: "" };
}
