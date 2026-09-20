"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ACTIVITY_COPY,
  BLOCKING_KINDS,
  REASON_BLOQUEO_MANUAL,
  REASON_EXCEPCION_CIERRE,
  findSlotOccupancy,
  getDayActivity,
  type ActivityKind,
} from "@/lib/admin/day-activity";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import {
  buildSlotsForDay,
  minutesToClock,
  normalizeSlotTime,
  parseClockToMinutes,
  type ClubHoursBounds,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import {
  ensureFixedSlotExceptionForDate,
  notifyFixedSlotExceptionRecipients,
} from "@/lib/fixed-slot-exceptions";
import { createClient } from "@/utils/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function longDate(date: string): string {
  try {
    return format(parseISO(`${date}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return date;
  }
}

// ---------------------------------------------------------------------------
// Preview de actividad del día
// ---------------------------------------------------------------------------

export type ActivityGroup = {
  kind: ActivityKind;
  count: number;
  label: string;
  hint: string;
};

export type ActivityLine = {
  kind: ActivityKind;
  courtName: string;
  time: string;
  detail: string;
};

export type DayPreview = {
  ok: true;
  date: string;
  dateLabel: string;
  alreadyClosed: boolean;
  canClose: boolean;
  /** Lo que el dueño tiene que resolver a mano antes de cerrar. */
  blockers: ActivityGroup[];
  /** Lo que el cierre resuelve o convive sin intervención. */
  resolvable: ActivityGroup[];
  lines: ActivityLine[];
  totalActivity: number;
};

export type DayPreviewResult = DayPreview | { ok: false; error: string };

function groupOf(kind: ActivityKind, count: number): ActivityGroup {
  const copy = ACTIVITY_COPY[kind];
  return {
    kind,
    count,
    label: count === 1 ? copy.singular : copy.plural,
    hint: copy.hint,
  };
}

/**
 * Analiza qué hay agendado un día antes de dejar cerrarlo. No escribe nada.
 * Lo llama la UI al elegir la fecha; `closeDayAction` vuelve a correr el mismo
 * análisis al confirmar, así que una reserva que entra entre el preview y el
 * click no se cuela.
 */
export async function previewDayAction(date: string): Promise<DayPreviewResult> {
  const day = String(date ?? "").trim();
  if (!DATE_RE.test(day)) return { ok: false, error: "Fecha inválida." };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  if (!ctx.clubIds.length) return { ok: false, error: "No tenés un club asignado." };

  // Mismo club que cierra closeDayAction: el preview no puede analizar otro alcance.
  const clubId = ctx.clubIds[0];
  const activity = await getDayActivity(supabase, {
    clubId,
    courts: ctx.courts.filter((c) => c.club_id === clubId),
    date: day,
  });

  const blockers = BLOCKING_KINDS.filter((k) => activity.counts[k] > 0).map((k) =>
    groupOf(k, activity.counts[k])
  );
  const resolvable = (["fixed_slot", "external_training", "manual_block", "other_block"] as ActivityKind[])
    .filter((k) => activity.counts[k] > 0)
    .map((k) => groupOf(k, activity.counts[k]));

  // Un día ya cerrado solo se puede "volver a cerrar" si quedaron turnos fijos
  // sin saltear de una corrida anterior (reintento de closeDayAction).
  const hasPendingFixedSlots =
    activity.fixedSlotIdsWithoutException.length > 0 || activity.items.some((i) => i.kind === "fixed_slot");

  return {
    ok: true,
    date: day,
    dateLabel: longDate(day),
    alreadyClosed: activity.alreadyClosed,
    canClose: activity.canClose && (!activity.alreadyClosed || hasPendingFixedSlots),
    blockers,
    resolvable,
    lines: activity.items.map((i) => ({
      kind: i.kind,
      courtName: i.courtName,
      time: i.time,
      detail: i.detail,
    })),
    totalActivity: activity.items.length,
  };
}

// ---------------------------------------------------------------------------
// Cerrar / reabrir un día
// ---------------------------------------------------------------------------

export type CloseDayResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Cierra un día completo. Solo avanza si no hay actividad bloqueante
 * (reservas, partidos abiertos, torneos, clases con alumnos): esas se resuelven
 * en sus propios flujos, donde vive la decisión de reembolso.
 *
 * Lo único que cancela son las ocurrencias de turno fijo de esa fecha, vía
 * excepción — la regla semanal en `fixed_slots` queda intacta.
 */
export async function closeDayAction(formData: FormData): Promise<CloseDayResult> {
  const date = getField(formData, "closed_date");
  const reason = getField(formData, "reason");
  if (!DATE_RE.test(date)) return { ok: false, error: "Fecha inválida." };
  if (date < getTodayYmdInArgentina()) {
    return { ok: false, error: "No podés cerrar una fecha que ya pasó." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) return { ok: false, error: "No tenés un club asignado." };

  const clubId = ctx.clubIds[0];

  // Se vuelve a analizar contra la DB, no se confía en el preview del cliente.
  const activity = await getDayActivity(supabase, {
    clubId,
    courts: ctx.courts.filter((c) => c.club_id === clubId),
    date,
  });
  // Turnos fijos que faltan resolver: sin excepción, o con excepción pero con la
  // ocurrencia todavía viva (corrida anterior que falló a mitad de camino).
  // ensureFixedSlotExceptionForDate es idempotente, así que repetirlos es seguro.
  const pendingFixedSlotIds = Array.from(
    new Set([
      ...activity.fixedSlotIdsWithoutException,
      ...activity.items.flatMap((i) => (i.kind === "fixed_slot" && i.fixedSlotId ? [i.fixedSlotId] : [])),
    ])
  );

  if (activity.alreadyClosed && pendingFixedSlotIds.length === 0) {
    return { ok: false, error: "Ese día ya estaba marcado como cerrado." };
  }
  if (!activity.canClose) {
    const detail = activity.blockers
      .map((k) => `${activity.counts[k]} ${activity.counts[k] === 1 ? ACTIVITY_COPY[k].singular : ACTIVITY_COPY[k].plural}`)
      .join(", ");
    return {
      ok: false,
      error: `No se puede cerrar: hay ${detail}. Resolvelos primero desde su sección.`,
    };
  }

  if (!activity.alreadyClosed) {
    const { error: insertErr } = await supabase.from(DB_TABLES.clubClosedDays).insert({
      club_id: clubId,
      closed_date: date,
      reason: reason || null,
    });
    // 23505 = unique (club_id, closed_date): otra corrida lo cerró en paralelo.
    if (insertErr && insertErr.code !== "23505") return { ok: false, error: insertErr.message };
  }

  // Turnos fijos: una excepción por regla. La recurrencia no se toca, solo se
  // saltea esta fecha. Primero toda la DB, después los avisos: una push caída
  // no deja turnos a medio cancelar, y un turno que falla no frena al resto.
  let exceptions = 0;
  let failed = 0;
  const notices: Array<{ playerIds: string[]; matchId: string | null; body: string }> = [];
  if (pendingFixedSlotIds.length) {
    const { data: slotRows, error: slotsErr } = await supabase
      .from(DB_TABLES.fixedSlots)
      .select("id,start_time")
      .in("id", pendingFixedSlotIds);
    if (slotsErr) {
      return { ok: false, error: `El día quedó cerrado, pero no pudimos cargar los turnos fijos. Volvé a cerrar el día para reintentar.` };
    }

    const dateLabel = longDate(date);
    for (const slot of (slotRows ?? []) as Array<{ id: string; start_time: string }>) {
      const slotTime = String(slot.start_time).slice(0, 5);
      const result = await ensureFixedSlotExceptionForDate(supabase, {
        fixedSlotId: slot.id,
        exceptionDate: date,
        reason: REASON_EXCEPCION_CIERRE,
        cancelledBy: ctx.userId,
      });
      if (!result.ok) {
        failed++;
        continue;
      }
      if (result.exceptionCreated || result.cancelledMatchId) exceptions++;
      if (result.notifyPlayerIds.length) {
        notices.push({
          playerIds: result.notifyPlayerIds,
          matchId: result.cancelledMatchId,
          body: result.cancelledMatchId
            ? `El club no abre el ${dateLabel}. Tu turno fijo de las ${slotTime} de ese día quedó cancelado. Las semanas siguientes siguen normal.`
            : `El club no abre el ${dateLabel}, así que ese día no hay turno fijo de las ${slotTime}. Las semanas siguientes siguen normal.`,
        });
      }
    }
  }

  for (const notice of notices) {
    await notifyFixedSlotExceptionRecipients(supabase, notice);
  }

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/turnos-fijos");
  revalidatePath("/admin/dashboard");

  if (failed > 0) {
    return {
      ok: false,
      error: `El día quedó cerrado, pero ${failed} ${failed === 1 ? "turno fijo no se pudo" : "turnos fijos no se pudieron"} saltear. Volvé a cerrar el día para reintentar.`,
    };
  }

  const extra = exceptions > 0 ? ` Se saltearon ${exceptions} ${exceptions === 1 ? "turno fijo" : "turnos fijos"} solo ese día.` : "";
  return { ok: true, message: `Día cerrado.${extra}` };
}

/**
 * Reabre un día. Solo borra la fila de `club_closed_days`: la disponibilidad
 * general vuelve, pero nada de lo que se canceló se restaura (ver README de la
 * feature). Los entrenamientos externos sí vuelven a aplicar solos, porque su
 * regla nunca se tocó.
 */
export async function removeClosedDayAction(formData: FormData): Promise<CloseDayResult> {
  const id = getField(formData, "closed_day_id");
  if (!id) return { ok: false, error: "Cierre inválido." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) return { ok: false, error: "No tenés un club asignado." };

  const { data: row } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id,club_id")
    .eq("id", id)
    .maybeSingle();
  const closedDay = row as { id: string; club_id: string } | null;
  if (!closedDay || closedDay.club_id !== ctx.clubIds[0]) {
    return { ok: false, error: "Cierre no autorizado." };
  }

  const { error } = await supabase.from(DB_TABLES.clubClosedDays).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: "Día reabierto. Los turnos fijos cancelados de esa fecha no se restauran." };
}

// ---------------------------------------------------------------------------
// Bloqueo puntual de un horario
// ---------------------------------------------------------------------------

const BLOCK_SLOT_MINUTES = 90;
const MAX_BLOCKS_PER_BATCH = 200;

/** Turnos reales por cancha ese día (buildSlotsForDay), con una sola lectura de franjas y horario del club. */
async function loadSlotsByCourt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courtIds: string[],
  clubId: string,
  date: string
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!courtIds.length) return result;
  const [{ data: rangeRows }, { data: clubRow }] = await Promise.all([
    supabase
      .from(DB_TABLES.courtTimeRanges)
      .select("court_id,day_of_week,open_time,close_time")
      .in("court_id", courtIds),
    supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", clubId).maybeSingle(),
  ]);
  const timeRanges = (rangeRows ?? []) as CourtTimeRangeInput[];
  const clubBounds = (clubRow ?? null) as ClubHoursBounds | null;
  const dayDate = new Date(`${date}T12:00:00`);
  for (const courtId of courtIds) {
    result.set(
      courtId,
      buildSlotsForDay([courtId], dayDate, timeRanges, clubBounds, BLOCK_SLOT_MINUTES).map((s) => s.time)
    );
  }
  return result;
}

export type BlockGridSlot = { time: string; endTime: string; occupied: boolean; detail: string };
export type BlockGridCourt = { id: string; name: string; slots: BlockGridSlot[] };
export type BlockGridResult =
  | { ok: true; date: string; dayClosed: boolean; courts: BlockGridCourt[] }
  | { ok: false; error: string };

/**
 * Grilla cancha × horario de una fecha para el bloqueo en lote. Solo informa:
 * lo que se muestra libre acá NO autoriza a insertar — createManualBlocksAction
 * vuelve a validar cada combinación contra la DB.
 */
export async function getBlockGridAction(date: string): Promise<BlockGridResult> {
  const day = String(date ?? "").trim();
  if (!DATE_RE.test(day)) return { ok: false, error: "Fecha inválida." };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  if (!ctx.clubIds.length) return { ok: false, error: "No tenés un club asignado." };

  const clubId = ctx.clubIds[0];
  const courts = ctx.courts.filter((c) => c.club_id === clubId);
  const [slotsByCourt, activity] = await Promise.all([
    loadSlotsByCourt(
      supabase,
      courts.map((c) => c.id),
      clubId,
      day
    ),
    getDayActivity(supabase, { clubId, courts, date: day }),
  ]);

  return {
    ok: true,
    date: day,
    dayClosed: activity.alreadyClosed,
    courts: courts.map((c) => ({
      id: c.id,
      name: c.name?.trim() || "Cancha",
      slots: (slotsByCourt.get(c.id) ?? []).map((time) => {
        const occ = findSlotOccupancy(activity, c.id, time, BLOCK_SLOT_MINUTES);
        return {
          time,
          endTime: minutesToClock(parseClockToMinutes(time) + BLOCK_SLOT_MINUTES),
          occupied: occ.occupied,
          detail: occ.occupied ? occ.detail : "",
        };
      }),
    })),
  };
}

export type BlockResult = { ok: true; message: string } | { ok: false; error: string };

export type BlockSlotInput = { courtId: string; startTime: string; endTime?: string };
export type BlockConflict = { courtId: string; courtName: string; time: string; detail: string };
export type BulkBlockResult =
  | { ok: true; message: string; created: number }
  | { ok: false; error: string; conflicts: BlockConflict[] };

/**
 * Bloquea en una sola operación un conjunto EXPLÍCITO de combinaciones
 * cancha + horario de una fecha (nunca el producto cartesiano).
 *
 * Todo o nada:
 * 1. Valida cada combinación contra la DB (cancha del club, turno real de
 *    buildSlotsForDay, ocupación por solapamiento de rango). Si alguna falla no
 *    se escribe nada y se devuelven las que hay que revisar.
 * 2. Inserta todas las filas en UN solo INSERT: Postgres lo aplica completo o
 *    no aplica ninguna.
 * 3. Vuelve a leer la ocupación: si entre la validación y el insert se coló una
 *    reserva / partido / turno fijo, borra las filas recién creadas y rechaza el
 *    lote. Desde el insert en adelante, reservarCancha y abrirPartido ya ven el
 *    bloqueo y rechazan ese turno.
 *
 * Un día cerrado no rechaza el lote (mismo criterio que el bloqueo puntual de
 * antes): el bloqueo sigue valiendo si después se reabre la fecha.
 */
export async function createManualBlocksAction(input: {
  date: string;
  note?: string;
  slots: BlockSlotInput[];
}): Promise<BulkBlockResult> {
  const fail = (error: string, conflicts: BlockConflict[] = []): BulkBlockResult => ({ ok: false, error, conflicts });
  const date = String(input?.date ?? "").trim();
  const note = String(input?.note ?? "").trim().slice(0, 120);
  const rawSlots = Array.isArray(input?.slots) ? input.slots : [];

  if (!DATE_RE.test(date)) return fail("Fecha inválida.");
  if (date < getTodayYmdInArgentina()) return fail("No podés bloquear horarios de una fecha que ya pasó.");
  if (rawSlots.length === 0) return fail("Elegí al menos un horario.");
  if (rawSlots.length > MAX_BLOCKS_PER_BATCH) {
    return fail(`Podés bloquear hasta ${MAX_BLOCKS_PER_BATCH} horarios por vez.`);
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) return fail("No tenés un club asignado.");

  const clubId = ctx.clubIds[0];
  const clubCourts = ctx.courts.filter((c) => c.club_id === clubId);
  const courtNameById = new Map(clubCourts.map((c) => [c.id, c.name?.trim() || "Cancha"]));

  // Normalización + deduplicación. Un item con forma inválida rechaza el lote entero.
  const seen = new Set<string>();
  const slots: Array<{ courtId: string; time: string }> = [];
  for (const raw of rawSlots) {
    const courtId = String(raw?.courtId ?? "").trim();
    const time = normalizeSlotTime(String(raw?.startTime ?? ""));
    if (!courtId || !TIME_RE.test(time)) return fail("Hay horarios con datos inválidos.");
    if (!courtNameById.has(courtId)) return fail("Hay canchas que no pertenecen a tu club.");
    const expectedEnd = minutesToClock(parseClockToMinutes(time) + BLOCK_SLOT_MINUTES);
    if (raw?.endTime !== undefined && normalizeSlotTime(String(raw.endTime)) !== expectedEnd) {
      return fail("Hay horarios con un fin que no corresponde al turno.");
    }
    const key = `${courtId}__${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ courtId, time });
  }

  const conflictOf = (courtId: string, time: string, detail: string): BlockConflict => ({
    courtId,
    courtName: courtNameById.get(courtId) ?? "Cancha",
    time,
    detail,
  });

  const [slotsByCourt, activity] = await Promise.all([
    loadSlotsByCourt(
      supabase,
      Array.from(new Set(slots.map((s) => s.courtId))),
      clubId,
      date
    ),
    getDayActivity(supabase, { clubId, courts: clubCourts, date }),
  ]);

  const conflicts: BlockConflict[] = [];
  for (const s of slots) {
    if (!(slotsByCourt.get(s.courtId) ?? []).includes(s.time)) {
      conflicts.push(conflictOf(s.courtId, s.time, "La cancha no tiene ese turno ese día"));
      continue;
    }
    const occ = findSlotOccupancy(activity, s.courtId, s.time, BLOCK_SLOT_MINUTES);
    if (occ.occupied) {
      conflicts.push(conflictOf(s.courtId, s.time, occ.detail));
      continue;
    }
    // Dos turnos del mismo lote no pueden pisarse (franjas superpuestas de una cancha).
    const start = parseClockToMinutes(s.time);
    const clash = slots.find(
      (o) =>
        o !== s &&
        o.courtId === s.courtId &&
        parseClockToMinutes(o.time) < start + BLOCK_SLOT_MINUTES &&
        parseClockToMinutes(o.time) + BLOCK_SLOT_MINUTES > start
    );
    if (clash) conflicts.push(conflictOf(s.courtId, s.time, `Se superpone con ${clash.time} del mismo lote`));
  }
  if (conflicts.length) {
    return fail(
      "No pudimos bloquear los horarios porque algunos no están disponibles. No se bloqueó ninguno: revisá los marcados y volvé a intentar.",
      conflicts
    );
  }

  // Cada slot se crea vía admin_create_court_block: toma lock_court_day y
  // revalida (matches/court_blocks por rango/reservation_holds) DENTRO de la
  // misma transacción, así se serializa contra tournament_assign_match_slot
  // y el resto de los escritores reales de ocupación de cancha — el chequeo
  // en JS de arriba es la validación amigable, esta RPC es la garantía real.
  const insertedIds: string[] = [];
  const lateConflicts: BlockConflict[] = [];
  for (const s of slots) {
    const { data, error: rpcErr } = await supabase.rpc("admin_create_court_block", {
      p_owner_id: ctx.userId,
      p_club_id: clubId,
      p_court_id: s.courtId,
      p_date: date,
      p_start_time: s.time,
      p_duration_minutes: BLOCK_SLOT_MINUTES,
      p_reason: REASON_BLOQUEO_MANUAL,
      p_note: note || null,
    });
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string; block_id: string | null } | undefined;
    if (rpcErr || !row?.ok) {
      lateConflicts.push(conflictOf(s.courtId, s.time, rpcErr?.message ?? row?.reason ?? "No disponible"));
      break;
    }
    if (row.block_id) insertedIds.push(row.block_id);
  }

  if (lateConflicts.length) {
    if (insertedIds.length) {
      await supabase.from(DB_TABLES.courtBlocks).delete().in("id", insertedIds).eq("reason", REASON_BLOQUEO_MANUAL);
    }
    revalidatePath("/admin/bloqueos");
    return fail(
      "No pudimos bloquear los horarios porque algunos acaban de dejar de estar disponibles. No se bloqueó ninguno.",
      lateConflicts
    );
  }

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/dashboard");
  const n = insertedIds.length;
  return {
    ok: true,
    created: n,
    message: `${n === 1 ? "Se bloqueó 1 horario" : `Se bloquearon ${n} horarios`} el ${longDate(date)}.`,
  };
}

/**
 * Borra un bloqueo puntual. Solo los de `reason='bloqueo_manual'`: los de
 * entrenamiento y torneo los administra su propia sección y el cron de clases
 * los volvería a crear.
 */
export async function removeManualBlockAction(formData: FormData): Promise<BlockResult> {
  const id = getField(formData, "block_id");
  if (!id) return { ok: false, error: "Bloqueo inválido." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("id,court_id,reason")
    .eq("id", id)
    .maybeSingle();
  const block = row as { id: string; court_id: string | null; reason: string | null } | null;
  const clubCourtIds = ctx.courts.filter((c) => c.club_id === ctx.clubIds[0]).map((c) => c.id);
  if (!block || !block.court_id || !clubCourtIds.includes(block.court_id)) {
    return { ok: false, error: "Bloqueo no autorizado." };
  }
  if (String(block.reason ?? "").trim() !== REASON_BLOQUEO_MANUAL) {
    return { ok: false, error: "Ese bloqueo se administra desde su propia sección." };
  }

  const { error } = await supabase
    .from(DB_TABLES.courtBlocks)
    .delete()
    .eq("id", id)
    .eq("reason", REASON_BLOQUEO_MANUAL);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: "Bloqueo eliminado. El horario vuelve a estar disponible." };
}
