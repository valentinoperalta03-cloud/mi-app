"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getCurrentClockInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import {
  courtBlockStartsFromRows,
  normalizeSlotTime,
  parseClockToMinutes,
} from "@/lib/court-slots";
import { cancelConflictingOpenMatches } from "@/lib/match-conflict";
import { isMatchSlotConflictError } from "@/lib/match-slot-errors";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient } from "@/utils/supabase/server";
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

  const { data: row } = await supabase
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

  const outcome = await refundReservationPayment(supabase, matchId);
  if (outcome.kind === "failed") {
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent(outcome.message)}`
    );
  }

  await supabase.from(DB_TABLES.matches).update({ match_status: "cancelled" }).eq("id", matchId);

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

export async function cancelReservationAdmin(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const date = getField(formData, "date");
  if (!matchId) redirect("/admin/reservas");

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id,owner_id,match_type")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as {
    id: string;
    court_id: string;
    owner_id: string | null;
    match_type: string | null;
  } | null;
  if (!typed || typed.match_type !== "reservation" || !ctx.courtIds.includes(typed.court_id)) {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }

  const outcome = await refundReservationPayment(supabase, matchId);
  if (outcome.kind === "failed") {
    redirect(
      `/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}&refund_error=${encodeURIComponent(outcome.message)}`
    );
  }

  await supabase.from(DB_TABLES.matches).update({ match_status: "cancelled" }).eq("id", matchId);

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
  redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
}

// ---------------------------------------------------------------------------
// Reserva manual: el club anota una reserva desde el panel (ej. alguien que
// reservó por teléfono). Antes /admin/reservas era solo lectura + bloqueo.
// ---------------------------------------------------------------------------

export type PlayerSearchResult = { id: string; name: string; avatarUrl: string | null };

export async function searchPlayersAction(query: string): Promise<PlayerSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return [];

  const { data } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id,name,avatar_url")
    .ilike("name", `%${q}%`)
    .limit(8);

  return ((data ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>).map((p) => ({
    id: p.user_id,
    name: p.name?.trim() || "Jugador",
    avatarUrl: p.avatar_url ?? null,
  }));
}

export type ManualReservationState = { ok: boolean; message: string };

export async function createManualReservationAction(
  _prev: ManualReservationState,
  formData: FormData
): Promise<ManualReservationState> {
  void _prev;
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const time = getField(formData, "time");
  const reference = getField(formData, "reference");
  const financialStatusRaw = getField(formData, "financial_status");
  const paymentMethodRaw = getField(formData, "payment_method");
  const amountRaw = getField(formData, "amount");
  const playerIds = Array.from(
    new Set(formData.getAll("player_ids").map((v) => String(v).trim()).filter(Boolean))
  ).slice(0, 4);

  if (!courtId || !date || !time) return { ok: false, message: "Datos incompletos." };
  if (date < getTodayYmdInArgentina()) {
    return { ok: false, message: "No se pueden crear reservas en fechas pasadas." };
  }
  if (!reference) return { ok: false, message: "Completá un nombre o referencia." };
  if (!["unpaid", "partially_paid", "fully_paid"].includes(financialStatusRaw)) {
    return { ok: false, message: "Elegí el estado de pago." };
  }
  const financialStatus = financialStatusRaw as "unpaid" | "partially_paid" | "fully_paid";
  const paymentMethod = paymentMethodRaw === "transfer" ? "transfer" : "cash";
  const amount = financialStatus === "unpaid" ? 0 : Number(amountRaw);
  if (financialStatus !== "unpaid" && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, message: "Ingresá un monto válido." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  const court = ctx.courts.find((c) => c.id === courtId);
  if (!court) return { ok: false, message: "Cancha no autorizada." };

  const { data: existingMatch } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("court_id", courtId)
    .eq("scheduled_date", date)
    .eq("scheduled_time", time)
    .neq("match_status", "cancelled")
    .maybeSingle();
  if (existingMatch) return { ok: false, message: "Ese horario ya tiene una reserva." };

  const { data: existingBlock } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("id")
    .eq("court_id", courtId)
    .eq("blocked_date", date)
    .eq("blocked_time", time)
    .maybeSingle();
  if (existingBlock) return { ok: false, message: "Ese horario está bloqueado." };

  // Precio: precio del día específico si está configurado para esa hora, si
  // no el precio legacy (day_of_week IS NULL, previo a precios por día), si
  // no el precio base de la cancha (mismo criterio que CourtPricesClient).
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const { data: courtRow } = await supabase.from(DB_TABLES.courts).select("price").eq("id", courtId).maybeSingle();
  const { data: priceRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,start_time,price_override")
    .eq("court_id", courtId)
    .not("start_time", "is", null);
  const priceRowsTyped = (priceRows ?? []) as Array<{
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | null;
  }>;
  const override =
    priceRowsTyped.find((r) => r.day_of_week === dayOfWeek && String(r.start_time ?? "").slice(0, 5) === time)
      ?.price_override ??
    priceRowsTyped.find((r) => r.day_of_week === null && String(r.start_time ?? "").slice(0, 5) === time)
      ?.price_override;
  const basePrice = Number((courtRow as { price: number | null } | null)?.price ?? 0);
  const totalPrice = typeof override === "number" ? override : basePrice;

  const amountPaid = financialStatus === "unpaid" ? 0 : amount;
  const amountPending = Math.max(totalPrice - amountPaid, 0);
  const paymentStatus = financialStatus === "unpaid" ? "pending" : "paid";
  // match_status "reserved" en vez de "scheduled" cuando ya hay plata cobrada:
  // los crons de recordatorio (match-reminder, etc.) filtran por match_status
  // IN (reserved, full) — con "scheduled" la reserva quedaría invisible para
  // esos recordatorios pese a estar paga. Mismo criterio que el webhook de MP
  // y confirmOfflineCobro en /admin/cobros.
  const matchStatus = financialStatus === "unpaid" ? "scheduled" : "reserved";

  // owner_id: el primer jugador asignado si hay (así la reserva le aparece en
  // "Mis reservas", que filtra por owner_id — no alcanza con estar en
  // match_participants). Si no hay jugadores, el dueño del club como fallback,
  // asegurando su profile igual que fixed-slot-generator.ts.
  let ownerId = playerIds[0] ?? null;
  if (!ownerId) {
    ownerId = ctx.userId;
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
        return { ok: false, message: "No se pudo asegurar el perfil del club." };
      }
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
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: 90,
      court_id: courtId,
      owner_id: ownerId,
      manual_reference: reference,
      es_turno_fijo: false,
      date: new Date(`${date}T${time}:00-03:00`).toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return { ok: false, message: insertErr?.message ?? "No se pudo crear la reserva." };
  }
  const matchId = String((inserted as { id: string }).id);

  await cancelConflictingOpenMatches(supabase, courtId, date, time);

  if (playerIds.length > 0) {
    await supabase
      .from(DB_TABLES.matchParticipants)
      .insert(playerIds.map((playerId) => ({ match_id: matchId, player_id: playerId })));
    for (const playerId of playerIds) {
      await createNotification(supabase, {
        user_id: playerId,
        type: "reservation_confirmed",
        title: "Te asignaron una reserva",
        body: `El club te anotó en una reserva el ${date} a las ${time} en ${court.name ?? "la cancha"}.`,
        match_id: matchId,
      });
    }
  }

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
  return { ok: true, message: "Reserva creada." };
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

  const dayOfWeek = new Date(`${scheduledDate}T12:00:00`).getDay();
  const { data: courtRow } = await supabase.from(DB_TABLES.courts).select("price").eq("id", courtId).maybeSingle();
  const { data: priceRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,start_time,price_override")
    .eq("court_id", courtId)
    .not("start_time", "is", null);
  const priceRowsTyped = (priceRows ?? []) as Array<{
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | null;
  }>;
  const override =
    priceRowsTyped.find((r) => r.day_of_week === dayOfWeek && String(r.start_time ?? "").slice(0, 5) === timeNorm)
      ?.price_override ??
    priceRowsTyped.find((r) => r.day_of_week === null && String(r.start_time ?? "").slice(0, 5) === timeNorm)
      ?.price_override;
  const basePrice = Number((courtRow as { price: number | null } | null)?.price ?? 0);
  const totalPrice = typeof override === "number" ? override : basePrice;

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
    const { error: guestsErr } = await supabase.from(DB_TABLES.matchParticipants).insert(
      guestPlayers.map((g) => ({
        match_id: matchId,
        player_id: null,
        team: g.team,
        guest_name: g.name?.trim() || `Jugador encontrado por ${clubName}`,
      }))
    );
    if (guestsErr) {
      await supabase.from(DB_TABLES.matches).delete().eq("id", matchId);
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

  const { data: participantsRaw } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("team")
    .eq("match_id", matchId);
  const participants = (participantsRaw ?? []) as Array<{ team: number | null }>;
  if (participants.length >= 4) return { ok: false, error: "El partido ya está completo." };
  if (participants.filter((p) => p.team === team).length >= 2) {
    return { ok: false, error: "Ese equipo ya está completo." };
  }

  const clubName = ctx.clubs[0]?.name?.trim() || "Club";
  const guestName = input.guestName?.trim() || `Jugador encontrado por ${clubName}`;

  const { error } = await supabase
    .from(DB_TABLES.matchParticipants)
    .insert({ match_id: matchId, player_id: null, team, guest_name: guestName });
  if (error) return { ok: false, error: "No se pudo agregar el jugador." };

  revalidatePath("/admin/reservas");
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

  const { error } = await supabase
    .from(DB_TABLES.matchParticipants)
    .delete()
    .eq("id", participantId)
    .eq("match_id", matchId);
  if (error) return { ok: false, error: "No se pudo quitar el jugador." };

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

