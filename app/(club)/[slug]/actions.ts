"use server";

import { DB_TABLES } from "@/lib/db-tables";
import {
  buildSlotsForDay,
  courtBlockStartsFromRows,
  normalizeSlotTime,
  parseCloseTimeToMinutes,
  type ClubHoursBounds,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { getCurrentClockInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { resolveDepositCharge } from "@/lib/deposit-utils";
import { createGroupChat } from "@/lib/group-chats";
import { cancelConflictingOpenMatches } from "@/lib/match-conflict";
import { notifyClubOwner } from "@/lib/club-notify";
import { isMatchSlotConflictError } from "@/lib/match-slot-errors";
import { createMPPreference, getPublicBaseUrl } from "@/lib/mp-preference";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { isClubSubscriptionBlocked } from "@/lib/subscription-check";
import { createClient, createServiceClient } from "@/utils/supabase/server";

export type AvailabilitySlot = { time: string; courtIds: string[] };

export type ClubAvailabilityResult = {
  slots: AvailabilitySlot[];
  prices: Record<string, number>;
};

function clockToMinutes(clock: string): number {
  const [h, m] = clock.trim().slice(0, 5).split(":").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export async function getClubAvailability(
  clubId: string,
  dateStr: string
): Promise<ClubAvailabilityResult> {
  if (!clubId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { slots: [], prices: {} };

  const supabase = await createClient();

  const { data: courtRows } = await supabase.from(DB_TABLES.courts).select("id").eq("club_id", clubId);
  const courtIds = ((courtRows ?? []) as { id: string }[]).map((c) => c.id);
  if (courtIds.length === 0) return { slots: [], prices: {} };

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time,close_time")
    .eq("id", clubId)
    .maybeSingle();
  const clubBounds = (clubRow ?? null) as ClubHoursBounds | null;

  const { data: rangeRows } = await supabase
    .from(DB_TABLES.courtTimeRanges)
    .select("court_id,day_of_week,open_time,close_time")
    .in("court_id", courtIds);
  const timeRanges = (rangeRows ?? []) as CourtTimeRangeInput[];

  const dayDate = new Date(`${dateStr}T12:00:00`);

  // buildSlotsForDay ignora en qué franja propia cae cada cancha cuando se le
  // pasan varios courtIds a la vez (devuelve la unión de horarios) — hay que
  // pedirle los slots cancha por cancha para saber si ESA cancha realmente
  // abre en ese horario, no solo alguna del club.
  const perCourtSlots = new Map<string, Set<string>>();
  for (const cid of courtIds) {
    const slotsForCourt = buildSlotsForDay([cid], dayDate, timeRanges, clubBounds);
    perCourtSlots.set(cid, new Set(slotsForCourt.map((s) => s.time)));
  }
  const orderedTimes = Array.from(
    new Set(Array.from(perCourtSlots.values()).flatMap((s) => Array.from(s)))
  ).sort((a, b) => clockToMinutes(a) - clockToMinutes(b));

  const [{ data: matchRows }, { data: blockRowsModern }, { data: blockRowsLegacy }, { data: schedRows }] =
    await Promise.all([
      supabase
        .from(DB_TABLES.matches)
        .select("court_id,scheduled_time")
        .in("court_id", courtIds)
        .eq("scheduled_date", dateStr)
        .neq("match_status", "cancelled"),
      supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,blocked_time")
        .in("court_id", courtIds)
        .eq("blocked_date", dateStr),
      supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,start_time")
        .in("court_id", courtIds)
        .eq("date", dateStr),
      supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,start_time,price_override")
        .in("court_id", courtIds)
        .is("day_of_week", null)
        .not("start_time", "is", null)
        .not("price_override", "is", null),
    ]);

  const occupied = new Set<string>();
  for (const m of (matchRows ?? []) as { court_id: string | null; scheduled_time: string | null }[]) {
    if (m.court_id) occupied.add(`${m.court_id}__${normalizeSlotTime(m.scheduled_time)}`);
  }
  for (const b of (blockRowsModern ?? []) as { court_id: string | null; blocked_time: string | null }[]) {
    if (b.court_id) occupied.add(`${b.court_id}__${normalizeSlotTime(b.blocked_time)}`);
  }
  for (const b of (blockRowsLegacy ?? []) as { court_id: string | null; start_time: string | null }[]) {
    if (b.court_id) occupied.add(`${b.court_id}__${normalizeSlotTime(b.start_time)}`);
  }

  const prices: Record<string, number> = {};
  for (const r of (schedRows ?? []) as {
    court_id: string | null;
    start_time: string | null;
    price_override: number | null;
  }[]) {
    if (r.court_id && r.price_override != null) {
      prices[`${r.court_id}__${normalizeSlotTime(r.start_time)}`] = Number(r.price_override);
    }
  }

  const todayAr = getTodayYmdInArgentina();
  const nowMinutes = dateStr === todayAr ? clockToMinutes(getCurrentClockInArgentina()) : -1;

  const slots: AvailabilitySlot[] = [];
  for (const time of orderedTimes) {
    if (nowMinutes >= 0 && clockToMinutes(time) <= nowMinutes) continue;
    const freeCourtIds = courtIds.filter(
      (cid) => perCourtSlots.get(cid)!.has(time) && !occupied.has(`${cid}__${time}`)
    );
    if (freeCourtIds.length > 0) slots.push({ time, courtIds: freeCourtIds });
  }

  return { slots, prices };
}

type ReservarCanchaInput = {
  courtId: string;
  clubId: string;
  scheduledDate: string;
  scheduledTime: string;
};

type ReservarCanchaResult = { error: string } | { success: true; matchId: string; mpUrl: string };

/**
 * Reserva directa desde la página pública del club (no un partido abierto):
 * mismo flujo de validaciones y Mercado Pago que crearPartido(), pero
 * match_type: 'reservation' para que aparezca en /reservas del jugador y en
 * la grilla de /admin/reservas — no en el feed de partidos abiertos.
 */
export async function reservarCancha(input: ReservarCanchaInput): Promise<ReservarCanchaResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Necesitás iniciar sesión." };
  }

  const courtId = input.courtId?.trim() ?? "";
  const clubId = input.clubId?.trim() ?? "";
  const scheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledTime = input.scheduledTime?.trim() ?? "";

  if (!courtId || !clubId || !scheduledDate || !scheduledTime) {
    return { error: "Datos incompletos." };
  }

  const durationMinutes = 90;

  const allowedByRateLimit = await checkRateLimit(`create_match:${user.id}`, 5, 3600);
  if (!allowedByRateLimit) {
    return { error: "Límite de partidos creados por hora alcanzado." };
  }

  const { data: payerProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const payerName = (payerProfile as { name?: string | null } | null)?.name?.trim() ?? "";
  const nameParts = payerName.split(" ");
  const payerFirstName = nameParts[0] ?? "";
  const payerLastName = nameParts.slice(1).join(" ") ?? "";

  const { data: courtData, error: courtError } = await supabase
    .from(DB_TABLES.courts)
    .select(
      "club_id, price, name, clubs!inner(name, deposit_type, deposit_value, close_time)"
    )
    .eq("id", courtId)
    .maybeSingle();

  if (courtError || !courtData) {
    return { error: "No se pudo obtener la información de la cancha." };
  }

  const clubIdStr = String((courtData as { club_id?: string | null }).club_id ?? "").trim();
  if (clubIdStr !== clubId) {
    return { error: "No se pudo obtener la información de la cancha." };
  }

  // mp_access_token esta revocada para anon/authenticated: se lee aparte con service client.
  const { data: clubMpRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token")
    .eq("id", clubIdStr)
    .maybeSingle();
  const clubAccessToken = (clubMpRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? null;
  if (!clubAccessToken) {
    return { error: "Este club no acepta reservas online todavía. Contactalos directamente." };
  }
  const { canReceiveReservations } = await checkOnboardingStatus(supabase, clubIdStr);
  if (!canReceiveReservations) {
    return { error: "Este club no está disponible para reservas en este momento." };
  }
  if (await isClubSubscriptionBlocked(clubIdStr)) {
    return { error: "Este club no puede recibir reservas en este momento." };
  }

  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;
  const dayOfWeek = new Date(`${scheduledDate}T12:00:00`).getDay();
  const { data: slotPriceRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,start_time,price_override")
    .eq("court_id", courtId)
    .not("start_time", "is", null)
    .not("price_override", "is", null);
  const slotPriceRowsTyped = (slotPriceRows ?? []) as Array<{
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | null;
  }>;
  const specificPrice = slotPriceRowsTyped.find(
    (row) => row.day_of_week === dayOfWeek && String(row.start_time ?? "").slice(0, 5) === timeNorm
  )?.price_override;
  const legacyPrice = slotPriceRowsTyped.find(
    (row) => row.day_of_week === null && String(row.start_time ?? "").slice(0, 5) === timeNorm
  )?.price_override;
  const totalPrice = Number(specificPrice ?? legacyPrice ?? (courtData as { price: number | null }).price ?? 0);
  const clubDepositType =
    (courtData as { clubs?: { deposit_type?: "percentage" | "fixed" | null } | null }).clubs?.deposit_type ?? null;
  const clubDepositValue = Number(
    (courtData as { clubs?: { deposit_value?: number | null } | null }).clubs?.deposit_value ?? 0
  );
  const clubName = String((courtData as { clubs?: { name?: string | null } | null }).clubs?.name ?? "Club");
  const courtName = String((courtData as { name?: string | null }).name ?? "Cancha");

  if (!(clubDepositValue > 0)) {
    return { error: "Este club no tiene seña configurada." };
  }

  const slotStart = clockToMinutes(timeNorm);
  const clubCloseTime = String(
    (courtData as { clubs?: { close_time?: string | null } | null }).clubs?.close_time ?? ""
  ).trim();
  if (clubCloseTime) {
    const closeMinutes = parseCloseTimeToMinutes(clubCloseTime);
    if (slotStart + durationMinutes > closeMinutes) {
      return { error: "El club cierra antes de que termine ese turno." };
    }
  }

  const todayAr = getTodayYmdInArgentina();
  if (scheduledDate < todayAr) {
    return { error: "La fecha debe ser futura." };
  }
  if (scheduledDate === todayAr) {
    const nowMinutesAr = clockToMinutes(getCurrentClockInArgentina());
    if (slotStart < nowMinutesAr + 60) {
      return { error: "La fecha debe ser futura." };
    }
  }

  const { data: closedDayRows } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id")
    .eq("club_id", clubIdStr)
    .eq("closed_date", scheduledDate)
    .limit(1);
  if (closedDayRows?.length) {
    return { error: "El club está cerrado ese día." };
  }

  const [{ data: blockRowsModern }, { data: blockRowsLegacy }] = await Promise.all([
    supabase
      .from(DB_TABLES.courtBlocks)
      .select("blocked_time")
      .eq("court_id", courtId)
      .eq("blocked_date", scheduledDate),
    supabase.from(DB_TABLES.courtBlocks).select("start_time").eq("court_id", courtId).eq("date", scheduledDate),
  ]);
  const blockedStarts = courtBlockStartsFromRows(
    blockRowsModern as { blocked_time: string | null }[] | null,
    blockRowsLegacy as { start_time: string | null }[] | null
  );
  if (blockedStarts.has(normalizeSlotTime(timeNorm))) {
    return { error: "Esa cancha está bloqueada en ese horario." };
  }

  const { data: duplicatedMatch } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("owner_id", user.id)
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .eq("scheduled_time", timeNorm)
    .neq("match_status", "cancelled")
    .maybeSingle();
  if (duplicatedMatch) {
    return { error: "Ya tenés una reserva en ese horario." };
  }

  const { count: activeMatchesCount } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .in("match_status", ["scheduled", "reserved", "full"])
    .in("payment_status", ["paid", "pending", "cash_pending", "transfer_pending"]);
  if ((activeMatchesCount ?? 0) >= 3) {
    return { error: "Tenés demasiados partidos activos. Completá o cancelá uno antes de crear otro." };
  }

  const { data: conflicts, error: conflictsError } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_time,duration_minutes")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");
  if (conflictsError) {
    return { error: "No se pudo validar disponibilidad." };
  }
  for (const row of (conflicts ?? []) as { scheduled_time: string | null; duration_minutes: number | null }[]) {
    const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
    const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
    const slotEnd = slotStart + durationMinutes;
    const otherEnd = otherStart + otherDur;
    if (slotStart < otherEnd && otherStart < slotEnd) {
      return { error: "Ese horario ya no está disponible." };
    }
  }

  const depositAmount = resolveDepositCharge(totalPrice, clubDepositType, clubDepositValue);

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      owner_id: user.id,
      scheduled_date: scheduledDate,
      scheduled_time: timeNorm,
      duration_minutes: durationMinutes,
      total_price: totalPrice,
      payment_status: "pending",
      amount_paid: 0,
      amount_pending: totalPrice,
      financial_status: "unpaid",
      match_status: "scheduled",
      match_type: "reservation",
      location_name: clubName,
      date: new Date(`${scheduledDate}T${timeNorm}:00-03:00`).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMatchSlotConflictError(error)) {
      return { error: "Este horario ya fue reservado. Elegí otro." };
    }
    return { error: "No se pudo crear la reserva." };
  }

  const { error: participantError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: data.id,
    player_id: user.id,
    team: 1,
  });
  if (participantError) {
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: "No se pudo crear la reserva." };
  }

  await notifyClubOwner(supabase, clubIdStr, {
    title: "🎾 Nueva reserva",
    body: `${payerName || "Un jugador"} reservó ${courtName} el ${scheduledDate} a las ${timeNorm}.`,
    match_id: data.id,
  });

  const mp = await createMPPreference({
    matchId: data.id,
    amount: depositAmount,
    clubName,
    courtName,
    date: scheduledDate,
    userId: user.id,
    externalReference: `${data.id}__${user.id}`,
    payerEmail: user.email ?? "",
    payerFirstName,
    payerLastName,
    clubAccessToken,
    backUrls: {
      success: `${getPublicBaseUrl()}/reservas/confirmacion`,
      failure: `${getPublicBaseUrl()}/reservas/confirmacion`,
      pending: `${getPublicBaseUrl()}/reservas/confirmacion`,
    },
  });

  if ("error" in mp) {
    await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", data.id);
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: mp.error };
  }

  const { error: ownerPayErr } = await supabase.from(DB_TABLES.payments).insert({
    match_id: data.id,
    user_id: user.id,
    mp_preference_id: mp.prefId,
    status: "pending",
    amount: mp.total,
    payment_method: "mercadopago",
  });
  if (ownerPayErr) {
    await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", data.id);
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: "No se pudo registrar el pago. Intentá de nuevo." };
  }

  await cancelConflictingOpenMatches(supabase, courtId, scheduledDate, timeNorm);

  return { success: true, matchId: data.id, mpUrl: mp.initPoint };
}

type AbrirPartidoInput = {
  courtId: string;
  clubId: string;
  scheduledDate: string;
  scheduledTime: string;
  genderCategory: "masculino" | "femenino" | "mixto";
  categoryRange: string[];
  visibility: "publico" | "privado";
};

type AbrirPartidoResult = { error: string } | { success: true; matchId: string };

/**
 * Abre un partido abierto desde la página pública del club: match_type
 * 'amistoso', sin cobro al crear. El 4to jugador en unirse paga la seña
 * — ver requestToJoin en app/(player)/partidos/[id]/actions.ts.
 */
export async function abrirPartido(input: AbrirPartidoInput): Promise<AbrirPartidoResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Necesitás iniciar sesión." };
  }

  const courtId = input.courtId?.trim() ?? "";
  const clubId = input.clubId?.trim() ?? "";
  const scheduledDate = input.scheduledDate?.trim() ?? "";
  const scheduledTime = input.scheduledTime?.trim() ?? "";
  const genderCategory = input.genderCategory;
  const visibility = input.visibility;
  const categoryRange = Array.isArray(input.categoryRange) ? input.categoryRange.filter(Boolean) : [];

  if (!courtId || !clubId || !scheduledDate || !scheduledTime || !genderCategory || !visibility) {
    return { error: "Datos incompletos." };
  }

  const durationMinutes = 90;

  const allowedByRateLimit = await checkRateLimit(`create_match:${user.id}`, 5, 3600);
  if (!allowedByRateLimit) {
    return { error: "Límite de partidos creados por hora alcanzado." };
  }

  const { canReceiveReservations } = await checkOnboardingStatus(supabase, clubId);
  if (!canReceiveReservations) {
    return { error: "Este club no está disponible para partidos en este momento." };
  }
  if (await isClubSubscriptionBlocked(clubId)) {
    return { error: "Este club no puede recibir partidos en este momento." };
  }

  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;

  const todayAr = getTodayYmdInArgentina();
  if (scheduledDate < todayAr) {
    return { error: "La fecha debe ser futura." };
  }
  const slotStart = clockToMinutes(timeNorm);
  if (scheduledDate === todayAr) {
    const nowMinutesAr = clockToMinutes(getCurrentClockInArgentina());
    if (slotStart < nowMinutesAr + 60) {
      return { error: "La fecha debe ser futura." };
    }
  }

  const { data: closedDayRows } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id")
    .eq("club_id", clubId)
    .eq("closed_date", scheduledDate)
    .limit(1);
  if (closedDayRows?.length) {
    return { error: "El club está cerrado ese día." };
  }

  const [{ data: blockRowsModern }, { data: blockRowsLegacy }] = await Promise.all([
    supabase
      .from(DB_TABLES.courtBlocks)
      .select("blocked_time")
      .eq("court_id", courtId)
      .eq("blocked_date", scheduledDate),
    supabase.from(DB_TABLES.courtBlocks).select("start_time").eq("court_id", courtId).eq("date", scheduledDate),
  ]);
  const blockedStarts = courtBlockStartsFromRows(
    blockRowsModern as { blocked_time: string | null }[] | null,
    blockRowsLegacy as { start_time: string | null }[] | null
  );
  if (blockedStarts.has(normalizeSlotTime(timeNorm))) {
    return { error: "Esa cancha está bloqueada en ese horario." };
  }

  const { data: conflicts, error: conflictsError } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_time,duration_minutes")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");
  if (conflictsError) {
    return { error: "No se pudo validar disponibilidad." };
  }
  for (const row of (conflicts ?? []) as { scheduled_time: string | null; duration_minutes: number | null }[]) {
    const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
    const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
    const slotEnd = slotStart + durationMinutes;
    const otherEnd = otherStart + otherDur;
    if (slotStart < otherEnd && otherStart < slotEnd) {
      return { error: "Ese horario ya no está disponible." };
    }
  }

  const { count: activeMatchesCount } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .in("match_status", ["scheduled", "reserved", "full"])
    .in("payment_status", ["paid", "pending", "cash_pending", "transfer_pending"]);
  if ((activeMatchesCount ?? 0) >= 3) {
    return { error: "Tenés demasiados partidos activos. Completá o cancelá uno antes de crear otro." };
  }

  const { data: courtData, error: courtError } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id, price, name, clubs!inner(name)")
    .eq("id", courtId)
    .maybeSingle();
  if (courtError || !courtData) {
    return { error: "No se pudo obtener la información de la cancha." };
  }
  const clubIdStr = String((courtData as { club_id?: string | null }).club_id ?? "").trim();
  if (clubIdStr !== clubId) {
    return { error: "No se pudo obtener la información de la cancha." };
  }
  const clubName = String((courtData as { clubs?: { name?: string | null } | null }).clubs?.name ?? "Club");
  const courtName = String((courtData as { name?: string | null }).name ?? "Cancha");

  const dayOfWeek = new Date(`${scheduledDate}T12:00:00`).getDay();
  const { data: slotPriceRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,start_time,price_override")
    .eq("court_id", courtId)
    .not("start_time", "is", null)
    .not("price_override", "is", null);
  const slotPriceRowsTyped = (slotPriceRows ?? []) as Array<{
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | null;
  }>;
  const specificPrice = slotPriceRowsTyped.find(
    (row) => row.day_of_week === dayOfWeek && String(row.start_time ?? "").slice(0, 5) === timeNorm
  )?.price_override;
  const legacyPrice = slotPriceRowsTyped.find(
    (row) => row.day_of_week === null && String(row.start_time ?? "").slice(0, 5) === timeNorm
  )?.price_override;
  const totalPrice = Number(specificPrice ?? legacyPrice ?? (courtData as { price: number | null }).price ?? 0);

  const { data: payerProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const payerName = (payerProfile as { name?: string | null } | null)?.name?.trim() ?? "";

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      owner_id: user.id,
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
      visibility,
      gender_category: genderCategory,
      level_restricted: categoryRange.length > 0,
      category_range: categoryRange.length > 0 ? categoryRange : null,
      location_name: clubName,
      date: new Date(`${scheduledDate}T${timeNorm}:00-03:00`).toISOString(),
      result_available_at: new Date(
        new Date(`${scheduledDate}T${timeNorm}:00-03:00`).getTime() + durationMinutes * 60 * 1000
      ).toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMatchSlotConflictError(error)) {
      return { error: "Este horario ya fue reservado. Elegí otro." };
    }
    return { error: "No se pudo abrir el partido." };
  }

  const { error: participantError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: data.id,
    player_id: user.id,
    team: 1,
  });
  if (participantError) {
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: "No se pudo abrir el partido." };
  }

  const groupRes = await createGroupChat(
    supabase,
    user.id,
    `Partido en ${clubName} el ${scheduledDate}`,
    "",
    [],
    data.id
  );
  if (!groupRes.ok) {
    console.error("[abrirPartido] group chat", groupRes.message);
  }

  await notifyClubOwner(supabase, clubIdStr, {
    title: "🏆 Nuevo partido abierto",
    body: `${payerName || "Un jugador"} abrió un partido en ${courtName} el ${scheduledDate} a las ${timeNorm}.`,
    match_id: data.id,
  });

  return { success: true, matchId: data.id };
}
