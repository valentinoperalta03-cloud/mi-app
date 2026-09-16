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
  normalizeSlotTime,
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

export type SlotOption = { time: string; occupied: boolean; detail: string };
export type SlotOptionsResult =
  | { ok: true; slots: SlotOption[]; dayClosed: boolean }
  | { ok: false; error: string };

async function loadCourtSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courtId: string,
  clubId: string,
  date: string
): Promise<string[]> {
  const [{ data: rangeRows }, { data: clubRow }] = await Promise.all([
    supabase
      .from(DB_TABLES.courtTimeRanges)
      .select("court_id,day_of_week,open_time,close_time")
      .eq("court_id", courtId),
    supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", clubId).maybeSingle(),
  ]);
  const timeRanges = (rangeRows ?? []) as CourtTimeRangeInput[];
  const clubBounds = (clubRow ?? null) as ClubHoursBounds | null;
  return buildSlotsForDay([courtId], new Date(`${date}T12:00:00`), timeRanges, clubBounds).map((s) => s.time);
}

/**
 * Turnos reales de esa cancha ese día, con qué los ocupa. El formulario de
 * bloqueo elige de acá — nunca hay input de hora libre, así que no se puede
 * cargar un bloqueo en un horario en el que la cancha ni siquiera abre.
 */
export async function getSlotOptionsAction(courtId: string, date: string): Promise<SlotOptionsResult> {
  const court = String(courtId ?? "").trim();
  const day = String(date ?? "").trim();
  if (!court || !DATE_RE.test(day)) return { ok: false, error: "Datos incompletos." };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  const courtRef = ctx.courts.find((c) => c.id === court && c.club_id === ctx.clubIds[0]);
  if (!courtRef) return { ok: false, error: "Cancha no autorizada." };

  const [slots, activity] = await Promise.all([
    loadCourtSlots(supabase, court, courtRef.club_id, day),
    getDayActivity(supabase, {
      clubId: courtRef.club_id,
      courts: ctx.courts.filter((c) => c.club_id === courtRef.club_id),
      date: day,
    }),
  ]);

  return {
    ok: true,
    dayClosed: activity.alreadyClosed,
    slots: slots.map((time) => {
      const occ = findSlotOccupancy(activity, court, time);
      return {
        time,
        occupied: occ.occupied,
        detail: occ.occupied ? occ.detail : "",
      };
    }),
  };
}

export type BlockResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Bloquea un turno puntual de una cancha. Si el turno ya tiene cualquier
 * ocupación (reserva, turno fijo, entrenamiento, torneo, clase u otro bloqueo)
 * se rechaza y se dice qué lo ocupa: esta pantalla no cancela nada, para eso
 * está la sección de cada entidad.
 */
export async function createManualBlockAction(formData: FormData): Promise<BlockResult> {
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "blocked_date");
  const time = normalizeSlotTime(getField(formData, "blocked_time"));
  const note = getField(formData, "note").slice(0, 120);

  if (!courtId) return { ok: false, error: "Elegí una cancha." };
  if (!DATE_RE.test(date)) return { ok: false, error: "Fecha inválida." };
  if (!TIME_RE.test(time)) return { ok: false, error: "Elegí un horario." };
  if (date < getTodayYmdInArgentina()) {
    return { ok: false, error: "No podés bloquear un horario que ya pasó." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  const courtRef = ctx.courts.find((c) => c.id === courtId && c.club_id === ctx.clubIds[0]);
  if (!courtRef) return { ok: false, error: "Cancha no autorizada." };

  const validSlots = await loadCourtSlots(supabase, courtId, courtRef.club_id, date);
  if (!validSlots.includes(time)) {
    return { ok: false, error: `${courtRef.name ?? "La cancha"} no tiene un turno que arranque a las ${time} ese día.` };
  }

  const activity = await getDayActivity(supabase, {
    clubId: courtRef.club_id,
    courts: ctx.courts.filter((c) => c.club_id === courtRef.club_id),
    date,
  });
  const occupancy = findSlotOccupancy(activity, courtId, time);
  if (occupancy.occupied) {
    return {
      ok: false,
      error: `No podés bloquear ${courtRef.name ?? "esa cancha"} · ${time}. Hay ${occupancy.detail.toLowerCase()} en ese horario. Resolvelo primero.`,
    };
  }

  // `date` y `start_time` son NOT NULL en el schema actual aunque el código de
  // lectura use `blocked_date` / `blocked_time`: hay que escribir las cuatro.
  //
  // `reason` es el discriminador del tipo de bloqueo (entrenamiento_externo,
  // torneo, bloqueo_manual) y todas las queries filtran por igualdad exacta: el
  // motivo libre que escribe el dueño va en `note` (20260915200000).
  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: time,
    blocked_date: date,
    blocked_time: time,
    reason: REASON_BLOQUEO_MANUAL,
    note: note || null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: `Horario bloqueado: ${courtRef.name ?? "cancha"} · ${time}.` };
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
