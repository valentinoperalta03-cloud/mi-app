"use server";

import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import {
  buildSlotsForDay,
  parseClockToMinutes,
  parseCloseTimeToMinutes,
  type ClubHoursBounds,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { createClient, createServiceClient } from "@/utils/supabase/server";

/**
 * Disponibilidad de canchas para una fecha puntual: slots generados a partir
 * de `court_time_ranges` (o el horario del club como fallback) menos lo ya
 * ocupado por reservas/partidos abiertos (`matches`), turnos fijos
 * (`fixed_slots` menos excepciones), entrenamientos (`training_blocks`) y
 * bloqueos puntuales (`court_blocks`, incluidos los de otros partidos de
 * torneo ya agendados con reason='torneo'). Compartida entre el wizard de
 * creación (`app/admin/torneos/torneo-form.tsx`) y el scheduler de partidos ya
 * creados (`app/admin/torneos/[id]/TournamentScheduler.tsx`).
 */
export async function getCourtAvailabilityForDate(
  clubId: string,
  courtIds: string[],
  dateStr: string,
): Promise<{
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
}> {
  if (!courtIds.length) return { slots: [], occupiedByCourtAndSlot: {} };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) {
    return { slots: [], occupiedByCourtAndSlot: {} };
  }

  const service = createServiceClient();
  const dayDate = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = dayDate.getDay();

  const [
    { data: club },
    { data: timeRangesRaw },
    { data: matchesRaw },
    { data: fixedSlotsRaw },
    { data: trainingMetaRaw },
    { data: blocksRaw },
  ] = await Promise.all([
    service
      .from(DB_TABLES.clubs)
      .select("open_time, close_time")
      .eq("id", clubId)
      .maybeSingle(),
    service
      .from(DB_TABLES.courtTimeRanges)
      .select("court_id, day_of_week, open_time, close_time")
      .in("court_id", courtIds),
    service
      .from(DB_TABLES.matches)
      .select(
        "court_id, scheduled_time, duration_minutes, match_status, match_type, es_turno_fijo",
      )
      .in("court_id", courtIds)
      .eq("scheduled_date", dateStr),
    service
      .from(DB_TABLES.fixedSlots)
      .select("id, court_id, start_time, duration_minutes")
      .in("court_id", courtIds)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek),
    service
      .from(DB_TABLES.trainingBlocks)
      .select("court_id, start_time, end_time")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek),
    service
      .from(DB_TABLES.courtBlocks)
      .select("court_id, blocked_time, reason")
      .in("court_id", courtIds)
      .eq("blocked_date", dateStr),
  ]);

  const fixedSlotIds = ((fixedSlotsRaw ?? []) as Array<{ id: string }>).map(
    (s) => s.id,
  );
  const { data: exceptionsRaw } = fixedSlotIds.length
    ? await service
        .from(DB_TABLES.fixedSlotExceptions)
        .select("fixed_slot_id")
        .in("fixed_slot_id", fixedSlotIds)
        .eq("exception_date", dateStr)
    : { data: [] };
  const exceptedIds = new Set(
    ((exceptionsRaw ?? []) as Array<{ fixed_slot_id: string }>).map(
      (e) => e.fixed_slot_id,
    ),
  );

  const timeRanges = (timeRangesRaw ?? []) as CourtTimeRangeInput[];
  const clubBounds = club as ClubHoursBounds | null;
  const slots = buildSlotsForDay(courtIds, dayDate, timeRanges, clubBounds).map(
    (g) => g.time,
  );

  const occupiedByCourtAndSlot: Record<string, Record<string, string>> = {};
  function mark(
    courtId: string,
    startMin: number,
    durationMin: number,
    label: string,
  ) {
    if (startMin < 0) return;
    const map = (occupiedByCourtAndSlot[courtId] ??= {});
    for (const slot of slots) {
      const slotMin = parseClockToMinutes(slot);
      if (slotMin >= startMin && slotMin < startMin + durationMin) {
        if (!map[slot]) map[slot] = label;
      }
    }
  }

  for (const m of (matchesRaw ?? []) as Array<{
    court_id: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_status: string | null;
    match_type: string | null;
    es_turno_fijo: boolean | null;
  }>) {
    if (m.es_turno_fijo) continue;
    if (String(m.match_status ?? "").toLowerCase() === "cancelled") continue;
    const startMin = parseClockToMinutes(String(m.scheduled_time ?? ""));
    const duration =
      m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
    mark(
      m.court_id,
      startMin,
      duration,
      m.match_type === "amistoso" ? "Partido abierto" : "Reserva",
    );
  }

  for (const s of (fixedSlotsRaw ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string | null;
    duration_minutes: number | null;
  }>) {
    if (exceptedIds.has(s.id)) continue;
    const startMin = parseClockToMinutes(String(s.start_time ?? ""));
    const duration =
      s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : 90;
    mark(s.court_id, startMin, duration, "Turno fijo");
  }

  for (const t of (trainingMetaRaw ?? []) as Array<{
    court_id: string;
    start_time: string;
    end_time: string;
  }>) {
    const startMin = parseClockToMinutes(String(t.start_time));
    const endMin = parseCloseTimeToMinutes(String(t.end_time));
    mark(
      t.court_id,
      startMin,
      Math.max(30, endMin - startMin),
      "Entrenamiento",
    );
  }

  for (const b of (blocksRaw ?? []) as Array<{
    court_id: string;
    blocked_time: string | null;
    reason: string | null;
  }>) {
    const startMin = parseClockToMinutes(String(b.blocked_time ?? ""));
    const label =
      b.reason === "torneo"
        ? "Torneo"
        : b.reason === "entrenamiento_externo"
          ? "Entrenamiento"
          : "Bloqueado";
    mark(b.court_id, startMin, 90, label);
  }

  return { slots, occupiedByCourtAndSlot };
}
