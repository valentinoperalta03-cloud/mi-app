"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { resolveCourtSlotPrice } from "@/lib/court-pricing";
import { getCurrentClockInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import {
  courtBlockStartsFromRows,
  normalizeSlotTime,
  parseClockToMinutes,
} from "@/lib/court-slots";
import { cancelConflictingOpenMatches } from "@/lib/match-conflict";
import { insertFixedSlotExceptionIfNeeded } from "@/lib/fixed-slot-exceptions";
import { isMatchSlotConflictError } from "@/lib/match-slot-errors";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { getClubAvailability, type ClubAvailabilityResult } from "../../(club)/[slug]/actions";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function requestReservationRefundAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const date = getField(formData, "date");
  if (!matchId) {
    redirect("/admin/reservas");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }

  // Se lee con service role: RLS de matches solo expone la fila al cliente de
  // sesión cuando auth.uid() = matches.owner_id (el JUGADOR dueño de la
  // reserva), así que con la sesión del club el SELECT no encontraba la fila
  // (maybeSingle devolvía null sin error) y el flujo abortaba en el primer
  // redirect como si la reserva no existiera. La autorización NO se relaja:
  // sigue siendo el club autenticado quien decide, vía ctx.courtIds
  // (derivado de clubs.owner_id = auth.uid()) validado justo abajo.
  const service = createServiceClient();
  const { data: row } = await service
    .from(DB_TABLES.matches)
    .select("id,court_id,owner_id,match_type,payment_status")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as {
    id: string;
    court_id: string;
    owner_id: string | null;
    match_type: string | null;
    payment_status: string | null;
  } | null;
  if (!typed || typed.match_type !== "reservation" || !ctx.courtIds.includes(typed.court_id)) {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }
  if (String(typed.payment_status ?? "").toLowerCase() !== "paid") {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }

  const outcome = await refundReservationPayment(service, matchId);
  // "refunded_unsynced" también corta acá: MP ya reembolsó pero no se pudo
  // persistir localmente. No seguir como si fuera éxito (evita re-cancelar
  // sobre un estado no sincronizado) ni reintentar el refund.
  if (outcome.kind === "failed" || outcome.kind === "refunded_unsynced") {
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent(outcome.message)}`
    );
  }

  // Igual que en cancelReservationAdmin: matches.owner_id = auth.uid() del
  // jugador bloquea este UPDATE con el cliente de sesión (RLS filtra la fila
  // sin error, quedando en "éxito" silencioso). Confirmar explícitamente que
  // se actualizó algo antes de seguir.
  const { data: updatedRows, error: cancelErr } = await service
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", matchId)
    .select("id");
  if (cancelErr || !updatedRows || updatedRows.length === 0) {
    console.error("[requestReservationRefundAction] no se pudo cancelar tras el reembolso", cancelErr, { matchId });
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent("El reembolso se procesó pero no se pudo marcar la reserva como cancelada. Contactá a soporte.")}`
    );
  }
  await insertFixedSlotExceptionIfNeeded(matchId);

  const { data: cancelledParticipants } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);
  const participantIds = new Set(
    ((cancelledParticipants ?? []) as Array<{ player_id: string }>).map((p) => p.player_id)
  );
  if (typed.owner_id) participantIds.add(typed.owner_id);
  for (const playerId of participantIds) {
    await createNotification(supabase, {
      user_id: playerId,
      type: "reservation_cancelled",
      title: "Reserva cancelada por el club",
      body:
        outcome.kind === "refunded"
          ? "Tu reserva fue cancelada por el club. Ya procesamos el reembolso a tu medio de pago."
          : "Tu reserva fue cancelada por el club.",
      match_id: matchId,
    });
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas/reembolsos");
  revalidatePath("/reservas");
  redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}`);
}

/**
 * "Cancelar reserva" desde el panel admin: SOLO libera el horario. No es un
 * reembolso (eso es el flujo separado "Reembolsar" / requestReservationRefundAction
 * arriba) y no aplica la política de cancelación tardía del jugador (esa lógica
 * vive en app/(player)/reservas/actions.ts y es responsabilidad de una
 * cancelación hecha POR EL JUGADOR, no de un cierre administrativo). Por eso
 * payment_status, amount_paid, amount_pending, financial_status y las filas de
 * `payments` quedan intactas: la plata ya cobrada sigue siendo auditable tal
 * cual estaba antes de cancelar.
 *
 * Antes esta función llamaba a refundReservationPayment() antes de cancelar:
 * si el reembolso real contra Mercado Pago fallaba por cualquier motivo (token
 * revocado, error de red, lo que sea), el `redirect` de la rama de error
 * cortaba la ejecución y la reserva JAMÁS se marcaba cancelled — el botón
 * "no hacía nada" para cualquier reserva con seña pagada.
 */
export async function cancelReservationAdmin(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const date = getField(formData, "date");
  if (!matchId) redirect("/admin/reservas");

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  // Se lee con service role: RLS de matches solo expone la fila al cliente de
  // sesión cuando auth.uid() = matches.owner_id (el JUGADOR dueño de la
  // reserva), así que con la sesión del club el SELECT no encontraba la fila
  // y el flujo abortaba como si la reserva no existiera. La autorización NO
  // se relaja: sigue siendo el club autenticado quien decide, vía
  // ctx.courtIds (derivado de clubs.owner_id = auth.uid()) validado abajo.
  const service = createServiceClient();
  const { data: row } = await service
    .from(DB_TABLES.matches)
    .select("id,court_id,owner_id,match_type,match_status")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as {
    id: string;
    court_id: string;
    owner_id: string | null;
    match_type: string | null;
    match_status: string | null;
  } | null;
  if (!typed || typed.match_type !== "reservation" || !ctx.courtIds.includes(typed.court_id)) {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }

  // Idempotente: ya cancelada (doble click, dos tabs, retry) — no hay nada más
  // que hacer, tratar como éxito en vez de fallar o duplicar notificaciones.
  if (typed.match_status === "cancelled") {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}&cancelled=1`);
  }

  // RLS de matches solo permite UPDATE cuando auth.uid() = matches.owner_id,
  // y owner_id acá es el JUGADOR que reservó, no el club — con el cliente de
  // sesión este UPDATE no matchea ninguna fila, no tira error, y quedaba como
  // "éxito" silencioso sin cancelar nada. Se reutiliza el mismo service client
  // de la lectura de arriba.
  const { data: updatedRows, error: cancelErr } = await service
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", matchId)
    .neq("match_status", "cancelled")
    .select("id");
  if (cancelErr) {
    console.error("[cancelReservationAdmin]", cancelErr);
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent("No se pudo cancelar la reserva. Intentá de nuevo.")}`
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    console.error("[cancelReservationAdmin] update afectó 0 filas", { matchId });
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent("No se pudo cancelar la reserva. Intentá de nuevo.")}`
    );
  }
  await insertFixedSlotExceptionIfNeeded(matchId);

  const { data: cancelledParticipants } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);
  const participantIds = new Set(
    ((cancelledParticipants ?? []) as Array<{ player_id: string }>).map((p) => p.player_id)
  );
  if (typed.owner_id) participantIds.add(typed.owner_id);
  for (const playerId of participantIds) {
    await createNotification(supabase, {
      user_id: playerId,
      type: "reservation_cancelled",
      title: "Reserva cancelada por el club",
      body: "Tu reserva fue cancelada por el club.",
      match_id: matchId,
    });
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/reservas");
  redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}&cancelled=1`);
}

// ---------------------------------------------------------------------------
// Reserva manual: el club anota una reserva desde el panel (ej. alguien que
// reservó por teléfono). Sin jugadores, sin búsqueda — la referencia visible
// es texto libre (manual_reference). owner_id queda en el dueño del club
// solo como necesidad técnica de la FK, nunca se lo presenta como "jugador".
// ---------------------------------------------------------------------------

export type AdminActionResult = { ok: true; matchId?: string } | { ok: false; error: string };

type CourtOwnershipResult =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; ctx: NonNullable<Awaited<ReturnType<typeof getOwnerAdminContext>>>; court: { id: string; name: string | null; club_id: string } };

async function assertCourtOwnership(courtId: string): Promise<CourtOwnershipResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { error: "Sesión requerida." };
  const court = ctx.courts.find((c) => c.id === courtId);
  if (!court) return { error: "Cancha no autorizada." };
  return { supabase, ctx, court };
}

export type CrearReservaAdminInput = {
  courtId: string;
  scheduledDate: string;
  scheduledTime: string;
  reference: string;
  financialStatus: "unpaid" | "partially_paid" | "fully_paid";
  paymentMethod?: "cash" | "transfer";
  amount?: number;
};

export async function crearReservaDesdeAdmin(input: CrearReservaAdminInput): Promise<AdminActionResult> {
  const courtId = input.courtId?.trim() ?? "";
  const scheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledTime = input.scheduledTime?.trim() ?? "";
  const reference = input.reference?.trim() ?? "";
  const financialStatus = input.financialStatus;
  const paymentMethod = input.paymentMethod === "transfer" ? "transfer" : "cash";
  const amount = Number(input.amount ?? 0);

  if (!courtId || !scheduledDate || !scheduledTime) return { ok: false, error: "Datos incompletos." };
  if (!reference) return { ok: false, error: "Completá un nombre o referencia." };
  if (!["unpaid", "partially_paid", "fully_paid"].includes(financialStatus)) {
    return { ok: false, error: "Elegí el estado de pago." };
  }
  if (financialStatus !== "unpaid" && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, error: "Ingresá un monto válido." };
  }

  const owned = await assertCourtOwnership(courtId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const { supabase, ctx, court } = owned;

  const durationMinutes = 90;
  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;

  const todayAr = getTodayYmdInArgentina();
  if (scheduledDate < todayAr) return { ok: false, error: "No se pueden crear reservas en fechas pasadas." };

  // Revalidación backend obligatoria: aunque el horario haya aparecido libre
  // en getAdminClubAvailability al abrir el modal, puede haber cambiado entre
  // que se abrió y se confirmó (otro admin reservó, se cargó un bloqueo,
  // etc.) — se vuelve a chequear club cerrado, bloqueo puntual y superposición
  // real contra la DB, mismo criterio que crearPartidoDesdeAdmin.
  const { data: closedDayRows } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id")
    .eq("club_id", court.club_id)
    .eq("closed_date", scheduledDate)
    .limit(1);
  if (closedDayRows?.length) return { ok: false, error: "El club está cerrado ese día." };

  const [{ data: blockRowsModern }, { data: blockRowsLegacy }] = await Promise.all([
    supabase.from(DB_TABLES.courtBlocks).select("blocked_time").eq("court_id", courtId).eq("blocked_date", scheduledDate),
    supabase.from(DB_TABLES.courtBlocks).select("start_time").eq("court_id", courtId).eq("date", scheduledDate),
  ]);
  const blockedStarts = courtBlockStartsFromRows(
    blockRowsModern as { blocked_time: string | null }[] | null,
    blockRowsLegacy as { start_time: string | null }[] | null
  );
  if (blockedStarts.has(normalizeSlotTime(timeNorm))) {
    return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
  }

  const { data: conflicts, error: conflictsError } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_time,duration_minutes")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");
  if (conflictsError) return { ok: false, error: "No se pudo validar disponibilidad." };
  const slotStart = parseClockToMinutes(timeNorm);
  const slotEnd = slotStart + durationMinutes;
  for (const row of (conflicts ?? []) as { scheduled_time: string | null; duration_minutes: number | null }[]) {
    const otherStart = parseClockToMinutes(String(row.scheduled_time ?? ""));
    const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
    const otherEnd = otherStart + otherDur;
    if (slotStart < otherEnd && otherStart < slotEnd) {
      return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
    }
  }

  // Precio server-side desde la fuente única (lib/court-pricing.ts).
  const totalPrice = await resolveCourtSlotPrice({ supabase, courtId, date: scheduledDate, startTime: timeNorm });

  const amountPaid = financialStatus === "unpaid" ? 0 : amount;
  const amountPending = Math.max(totalPrice - amountPaid, 0);
  const paymentStatus = financialStatus === "unpaid" ? "pending" : "paid";
  // match_status "reserved" en vez de "scheduled" cuando ya hay plata cobrada:
  // los crons de recordatorio (match-reminder, etc.) filtran por match_status
  // IN (reserved, full) — con "scheduled" la reserva quedaría invisible para
  // esos recordatorios pese a estar paga. Mismo criterio que el webhook de MP
  // y confirmOfflineCobro en /admin/cobros.
  const matchStatus = financialStatus === "unpaid" ? "scheduled" : "reserved";

  // owner_id: sin jugadores, el dueño del club queda como owner_id solo por
  // necesidad técnica de la FK (matches.owner_id NOT NULL) — la UI nunca lo
  // presenta como jugador de la reserva, la referencia visible es
  // manual_reference. Mismo criterio de asegurar el profile que
  // fixed-slot-generator.ts.
  const ownerId = ctx.userId;
  const { data: ownerProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!ownerProfile) {
    const { error: profileErr } = await supabase
      .from(DB_TABLES.profiles)
      .insert({ id: ownerId, user_id: ownerId, name: court.name ?? "Club" });
    if (profileErr && profileErr.code !== "23505") {
      return { ok: false, error: "No se pudo asegurar el perfil del club." };
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      match_type: "reservation",
      match_status: matchStatus,
      payment_status: paymentStatus,
      financial_status: financialStatus,
      total_price: totalPrice,
      amount_paid: amountPaid,
      amount_pending: amountPending,
      scheduled_date: scheduledDate,
      scheduled_time: timeNorm,
      duration_minutes: durationMinutes,
      court_id: courtId,
      owner_id: ownerId,
      manual_reference: reference,
      es_turno_fijo: false,
      date: new Date(`${scheduledDate}T${timeNorm}:00-03:00`).toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    // El constraint sin_partidos_superpuestos de la DB queda como última capa
    // de protección — si el pre-check de arriba no lo agarró (ej. carrera
    // entre dos admins reservando el mismo horario a la vez), acá se traduce
    // a un mensaje legible en vez del error crudo de Postgres.
    const error = isMatchSlotConflictError(insertErr)
      ? "Ese horario ya no está disponible. Elegí otro."
      : (insertErr?.message ?? "No se pudo crear la reserva.");
    return { ok: false, error };
  }
  const matchId = String((inserted as { id: string }).id);

  await cancelConflictingOpenMatches(supabase, courtId, scheduledDate, timeNorm);

  if (financialStatus === "unpaid") {
    await supabase.from(DB_TABLES.payments).insert({ match_id: matchId, user_id: ownerId, status: "pending", amount: 0 });
  } else {
    await supabase.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: ownerId,
      status: "approved",
      amount: amountPaid,
      payment_method: paymentMethod,
      mp_payment_id: "club_counter",
    });
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/dashboard");
  return { ok: true, matchId };
}

// ---------------------------------------------------------------------------
// Partidos abiertos desde el admin: el club publica un partido (match_type
// 'amistoso') y puede sumarle jugadores "encontrados por el club" sin cuenta
// en la app (player_id NULL, guest_name con el nombre — ver migración
// 20260818120000_admin_open_matches.sql).
// ---------------------------------------------------------------------------

export type GuestPlayerInput = { name: string; team: 1 | 2 };

export type CrearPartidoAdminInput = {
  courtId: string;
  scheduledDate: string;
  scheduledTime: string;
  genderCategory: "masculino" | "femenino" | "mixto";
  categoryRange: string[];
  guestPlayers: GuestPlayerInput[];
};

export async function crearPartidoDesdeAdmin(input: CrearPartidoAdminInput): Promise<AdminActionResult> {
  const courtId = input.courtId?.trim() ?? "";
  const scheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledTime = input.scheduledTime?.trim() ?? "";
  const genderCategory = input.genderCategory;
  const categoryRange = Array.isArray(input.categoryRange) ? input.categoryRange.filter(Boolean) : [];
  const guestPlayers = Array.isArray(input.guestPlayers) ? input.guestPlayers.slice(0, 3) : [];

  if (!courtId || !scheduledDate || !scheduledTime || !genderCategory) {
    return { ok: false, error: "Datos incompletos." };
  }
  const team1Count = guestPlayers.filter((g) => g.team === 1).length;
  const team2Count = guestPlayers.filter((g) => g.team === 2).length;
  if (team1Count > 2 || team2Count > 2) {
    return { ok: false, error: "Cada equipo admite máximo 2 jugadores." };
  }

  const owned = await assertCourtOwnership(courtId);
  if ("error" in owned) return { ok: false, error: owned.error };
  const { supabase, ctx, court } = owned;

  const durationMinutes = 90;
  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;

  const todayAr = getTodayYmdInArgentina();
  if (scheduledDate < todayAr) return { ok: false, error: "La fecha debe ser futura." };
  const slotStart = parseClockToMinutes(timeNorm);
  if (scheduledDate === todayAr) {
    const nowMinutesAr = parseClockToMinutes(getCurrentClockInArgentina());
    if (slotStart < nowMinutesAr + 60) return { ok: false, error: "La fecha debe ser futura." };
  }

  const { data: closedDayRows } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id")
    .eq("club_id", court.club_id)
    .eq("closed_date", scheduledDate)
    .limit(1);
  if (closedDayRows?.length) return { ok: false, error: "El club está cerrado ese día." };

  const [{ data: blockRowsModern }, { data: blockRowsLegacy }] = await Promise.all([
    supabase.from(DB_TABLES.courtBlocks).select("blocked_time").eq("court_id", courtId).eq("blocked_date", scheduledDate),
    supabase.from(DB_TABLES.courtBlocks).select("start_time").eq("court_id", courtId).eq("date", scheduledDate),
  ]);
  const blockedStarts = courtBlockStartsFromRows(
    blockRowsModern as { blocked_time: string | null }[] | null,
    blockRowsLegacy as { start_time: string | null }[] | null
  );
  if (blockedStarts.has(normalizeSlotTime(timeNorm))) {
    return { ok: false, error: "Esa cancha está bloqueada en ese horario." };
  }

  const { data: conflicts, error: conflictsError } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_time,duration_minutes")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");
  if (conflictsError) return { ok: false, error: "No se pudo validar disponibilidad." };
  for (const row of (conflicts ?? []) as { scheduled_time: string | null; duration_minutes: number | null }[]) {
    const otherStart = parseClockToMinutes(String(row.scheduled_time ?? ""));
    const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
    const slotEnd = slotStart + durationMinutes;
    const otherEnd = otherStart + otherDur;
    if (slotStart < otherEnd && otherStart < slotEnd) {
      return { ok: false, error: "Ese horario ya no está disponible." };
    }
  }

  const totalPrice = await resolveCourtSlotPrice({ supabase, courtId, date: scheduledDate, startTime: timeNorm });

  const clubName = ctx.clubs.find((c) => c.id === court.club_id)?.name?.trim() || "Club";

  const { data: inserted, error: insertErr } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      owner_id: ctx.userId,
      scheduled_date: scheduledDate,
      scheduled_time: timeNorm,
      duration_minutes: durationMinutes,
      total_price: totalPrice,
      payment_status: "pending",
      amount_paid: 0,
      amount_pending: totalPrice,
      financial_status: "unpaid",
      match_status: "scheduled",
      match_type: "amistoso",
      created_by_club: true,
      visibility: "publico",
      gender_category: genderCategory,
      level_restricted: categoryRange.length > 0,
      category_range: categoryRange.length > 0 ? categoryRange : null,
      location_name: clubName,
      date: new Date(`${scheduledDate}T${timeNorm}:00-03:00`).toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    if (isMatchSlotConflictError(insertErr)) {
      return { ok: false, error: "Este horario ya fue reservado. Elegí otro." };
    }
    return { ok: false, error: insertErr?.message ?? "No se pudo abrir el partido." };
  }
  const matchId = String((inserted as { id: string }).id);

  if (guestPlayers.length > 0) {
    // RLS de match_participants exige auth.uid() = player_id tanto en INSERT
    // como en DELETE — un Jugador X tiene player_id NULL, así que el cliente
    // autenticado normal no puede insertarlo. El ownership de la cancha ya
    // se validó arriba vía assertCourtOwnership, así que acá se usa
    // service role solo para este insert puntual (no reemplaza validaciones).
    const service = createServiceClient();
    const { error: guestsErr } = await service.from(DB_TABLES.matchParticipants).insert(
      guestPlayers.map((g) => ({
        match_id: matchId,
        player_id: null,
        team: g.team,
        guest_name: g.name?.trim() || "Jugador X",
      }))
    );
    if (guestsErr) {
      await service.from(DB_TABLES.matches).delete().eq("id", matchId);
      return { ok: false, error: "No se pudieron agregar los jugadores." };
    }
  }

  revalidatePath("/admin/reservas");
  return { ok: true, matchId };
}

export type AgregarJugadorAdminInput = { matchId: string; guestName: string; team: 1 | 2 };

export async function agregarJugadorDesdeAdmin(input: AgregarJugadorAdminInput): Promise<AdminActionResult> {
  const matchId = input.matchId?.trim() ?? "";
  const team = input.team;
  if (!matchId || (team !== 1 && team !== 2)) return { ok: false, error: "Datos incompletos." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id,match_type,match_status")
    .eq("id", matchId)
    .maybeSingle();
  const match = matchRow as { id: string; court_id: string; match_type: string | null; match_status: string | null } | null;
  if (!match || !ctx.courtIds.includes(match.court_id) || match.match_type !== "amistoso") {
    return { ok: false, error: "Partido no autorizado." };
  }
  if (match.match_status === "cancelled") return { ok: false, error: "Ese partido ya está cancelado." };

  const guestName = input.guestName?.trim() || "Jugador X";

  // El cupo y la transición scheduled -> full (+ confirmed_at, que activa la
  // política de cancelación) las resuelve el RPC en un solo bloque con FOR
  // UPDATE: el count + insert que había acá dejaba pasar dos altas simultáneas
  // y, sobre todo, completaba el partido sin marcarlo confirmado.
  //
  // Se llama con service role porque RLS de match_participants exige
  // auth.uid() = player_id y un Jugador X tiene player_id NULL; el RPC revalida
  // la pertenencia del partido igual que la action.
  const service = createServiceClient();
  const { data: rpcRows, error } = await service.rpc("add_guest_to_match_atomic", {
    p_match_id: matchId,
    p_team: team,
    p_guest_name: guestName,
  });
  if (error) return { ok: false, error: "No se pudo agregar el jugador." };

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok?: boolean; reason?: string | null }
    | null;
  if (!result?.ok) {
    const reason = String(result?.reason ?? "");
    if (reason === "match_full") return { ok: false, error: "El partido ya está completo." };
    if (reason === "team_full") return { ok: false, error: "Ese equipo ya está completo." };
    if (reason === "match_closed") return { ok: false, error: "Ese partido ya está cerrado." };
    return { ok: false, error: "No se pudo agregar el jugador." };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/cobros");
  return { ok: true };
}

export type QuitarJugadorAdminInput = { matchId: string; participantId: string };

export async function quitarJugadorDesdeAdmin(input: QuitarJugadorAdminInput): Promise<AdminActionResult> {
  const matchId = input.matchId?.trim() ?? "";
  const participantId = input.participantId?.trim() ?? "";
  if (!matchId || !participantId) return { ok: false, error: "Datos incompletos." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id")
    .eq("id", matchId)
    .maybeSingle();
  const match = matchRow as { id: string; court_id: string } | null;
  if (!match || !ctx.courtIds.includes(match.court_id)) {
    return { ok: false, error: "Partido no autorizado." };
  }

  // Ownership del partido ya validado arriba (matchId pertenece a una cancha
  // de ctx.courtIds). Recién acá se usa service role, porque RLS de
  // match_participants exige auth.uid() = player_id y un Jugador X tiene
  // player_id NULL — el cliente autenticado no puede borrarlo. El delete
  // sigue acotado por id + match_id, nunca un participantId arbitrario de
  // otro club.
  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.matchParticipants)
    .delete()
    .eq("id", participantId)
    .eq("match_id", matchId);
  if (error) return { ok: false, error: "No se pudo quitar el jugador." };

  // Misma regla que leave_match_atomic: con menos de 4 el partido vuelve a
  // buscar jugadores y confirmed_at se conserva. Sin carrera con un alta: mientras
  // el partido sigue en 'full', join_match_atomic y add_guest_to_match_atomic
  // rechazan la entrada, así que nadie puede sumarse entre el delete y este update.
  const { count: remaining } = await service
    .from(DB_TABLES.matchParticipants)
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if ((remaining ?? 0) < 4) {
    await service
      .from(DB_TABLES.matches)
      .update({ match_status: "scheduled" })
      .eq("id", matchId)
      .eq("match_status", "full");
  }

  revalidatePath("/admin/reservas");
  return { ok: true };
}

export async function cancelarPartidoDesdeAdmin(matchId: string): Promise<AdminActionResult> {
  const id = matchId?.trim() ?? "";
  if (!id) return { ok: false, error: "Datos incompletos." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id,scheduled_date,scheduled_time,location_name,match_type")
    .eq("id", id)
    .maybeSingle();
  const match = matchRow as {
    id: string;
    court_id: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    location_name: string | null;
    match_type: string | null;
  } | null;
  if (!match || !ctx.courtIds.includes(match.court_id) || match.match_type !== "amistoso") {
    return { ok: false, error: "Partido no autorizado." };
  }

  await supabase.from(DB_TABLES.matches).update({ match_status: "cancelled" }).eq("id", id);

  const { data: participantsRaw } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", id);
  const realPlayerIds = ((participantsRaw ?? []) as Array<{ player_id: string | null }>)
    .map((p) => p.player_id)
    .filter((v): v is string => Boolean(v));
  const locationLabel = match.location_name?.trim() || "el club";
  for (const playerId of new Set(realPlayerIds)) {
    await createNotification(supabase, {
      user_id: playerId,
      type: "match_cancelled",
      title: "❌ Partido cancelado",
      body: `El partido en ${locationLabel} el ${match.scheduled_date ?? ""} a las ${String(match.scheduled_time ?? "").slice(0, 5)} fue cancelado por el club.`,
      match_id: id,
    });
  }

  revalidatePath("/admin/reservas");
  return { ok: true };
}

/**
 * Disponibilidad real para el modal "Abrir partido" del admin. Reusa
 * getClubAvailability (misma lógica de bloqueo por reservas/partidos/turnos
 * fijos/court_blocks que usa la página pública del club) verificando antes
 * que el club pedido pertenezca al admin logueado.
 */
export async function getAdminClubAvailability(clubId: string, dateStr: string): Promise<ClubAvailabilityResult> {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) return { slots: [], prices: {} };
  return getClubAvailability(clubId, dateStr);
}

