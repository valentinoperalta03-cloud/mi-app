"use server";

import { redirect } from "next/navigation";
import { AR_TIME_ZONE, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { resolveDepositCharge } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { createMPPreference } from "@/lib/mp-preference";
import {
  isReservationSlotBlockingPaymentStatus,
  normalizePlayerPaymentMethod,
} from "@/lib/offline-payments";
import { notifyClubOwner } from "@/lib/club-notify";
import { isMatchSlotConflictError } from "@/lib/match-slot-errors";
import { createNotification } from "@/lib/notifications";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { isClubSubscriptionBlocked } from "@/lib/subscription-check";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function toIsoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function clockToMinutes(clock: string): number {
  const t = clock.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function overlaps(aStart: number, aLen: number, bStart: number, bLen: number) {
  const aEnd = aStart + aLen;
  const bEnd = bStart + bLen;
  return aStart < bEnd && bStart < aEnd;
}

function getCurrentClockInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export type CreateReservationResult = { error: string } | void;

export async function createReservation(formData: FormData): Promise<CreateReservationResult> {
  const courtId = getField(formData, "court_id");
  const scheduledDate = getField(formData, "scheduled_date");
  const scheduledTime = getField(formData, "scheduled_time");
  const durationMinutes = getField(formData, "duration_minutes");
  const clubName = getField(formData, "club_name");
  const courtName = getField(formData, "court_name");

  if (!courtId || !scheduledDate || !scheduledTime || !durationMinutes) {
    return { error: "Faltan datos de la reserva." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const allowedByRateLimit = await checkRateLimit(`create_reservation:${user.id}`, 5, 3600);
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

  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;
  const slotStart = clockToMinutes(timeNorm);
  const slotDur = Number(durationMinutes);
  if (!Number.isFinite(slotDur) || slotDur <= 0) {
    return { error: "Duración inválida." };
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

  const { data: duplicatedReservation } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("owner_id", user.id)
    .eq("match_type", "reservation")
    .in("payment_status", ["paid", "pending", "cash_pending", "transfer_pending"])
    .eq("scheduled_date", scheduledDate)
    .eq("scheduled_time", timeNorm)
    .neq("match_status", "cancelled")
    .maybeSingle();
  if (duplicatedReservation) {
    return { error: "Ya tenés una reserva en ese horario." };
  }

  const { count: activeMatchesCount } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .in("match_status", ["scheduled", "reserved", "full", "pending"])
    .in("payment_status", ["paid", "pending", "cash_pending", "transfer_pending"]);
  if ((activeMatchesCount ?? 0) >= 3) {
    return { error: "Tenés demasiados partidos activos. Completá o cancelá uno antes de crear otro." };
  }

  const { data: courtClub } = await supabase
    .from(DB_TABLES.courts)
    .select(
      "club_id, clubs!inner(accepts_cash, accepts_transfer, bank_alias, bank_cbu, deposit_type, deposit_value)"
    )
    .eq("id", courtId)
    .maybeSingle();
  const courtClubTyped = courtClub as {
    club_id?: string | null;
    clubs?: {
      accepts_cash?: boolean | null;
      accepts_transfer?: boolean | null;
      bank_alias?: string | null;
      bank_cbu?: string | null;
      deposit_type?: "percentage" | "fixed" | null;
      deposit_value?: number | null;
    } | null;
  } | null;
  const clubId = String(courtClubTyped?.club_id ?? "").trim();
  // mp_access_token esta revocada para anon/authenticated: se lee aparte con service client.
  const { data: clubMpRow } = clubId
    ? await createServiceClient().from(DB_TABLES.clubs).select("mp_access_token").eq("id", clubId).maybeSingle()
    : { data: null };
  const clubAccessToken = (clubMpRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? null;
  if (clubId) {
    if (!clubAccessToken) {
      return { error: "Este club no acepta reservas online todavía. Contactalos directamente." };
    }
    const { canReceiveReservations } = await checkOnboardingStatus(supabase, clubId);
    if (!canReceiveReservations) {
      return {
        error: "Este club no está disponible para reservas en este momento.",
      };
    }
    if (await isClubSubscriptionBlocked(clubId)) {
      return { error: "Este club no puede recibir reservas en este momento." };
    }
  }
  const clubDepositType = courtClubTyped?.clubs?.deposit_type ?? null;
  const clubDepositValue = Number(courtClubTyped?.clubs?.deposit_value ?? 0);
  const acceptsCash = Boolean(courtClubTyped?.clubs?.accepts_cash);
  const acceptsTransfer = Boolean(courtClubTyped?.clubs?.accepts_transfer);
  const bankAlias = String(courtClubTyped?.clubs?.bank_alias ?? "").trim();

  const paymentMethodRaw = normalizePlayerPaymentMethod(getField(formData, "payment_method"));
  const paymentMethod = paymentMethodRaw ?? "mercadopago";

  if (paymentMethod === "cash" && !acceptsCash) {
    return { error: "Este club no acepta pago en efectivo." };
  }
  if (paymentMethod === "transfer") {
    if (!acceptsTransfer) {
      return { error: "Este club no acepta transferencia bancaria." };
    }
    if (!bankAlias) {
      return { error: "El club no cargó un alias CBU para transferencias." };
    }
  }
  if (clubId) {
    const { data: blocked } = await supabase
      .from(DB_TABLES.blockedUsers)
      .select("id")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (blocked) {
      return { error: "No podés reservar en este club. Contactá al administrador." };
    }
  }

  const { data: conflicts } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_time,duration_minutes,match_type,payment_status,match_status")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .neq("match_status", "cancelled");

  for (const row of conflicts ?? []) {
    const r = row as {
      scheduled_time: string | null;
      duration_minutes: number | null;
      match_type: string | null;
      payment_status: string | null;
      match_status: string | null;
    };
    const isReservation = String(r.match_type ?? "").toLowerCase() === "reservation";
    const paymentStatus = String(r.payment_status ?? "").toLowerCase();
    const matchStatus = String(r.match_status ?? "").toLowerCase();
    const shouldBlockSlot =
      matchStatus !== "cancelled" &&
      (!isReservation || isReservationSlotBlockingPaymentStatus(paymentStatus));
    if (!shouldBlockSlot) continue;
    const otherStart = clockToMinutes(String(r.scheduled_time ?? "").trim());
    const otherDur =
      r.duration_minutes && Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : 90;
    if (overlaps(slotStart, slotDur, otherStart, otherDur)) {
      return { error: "Este horario ya fue reservado. Elegí otro." };
    }
  }

  const [{ data: blocksModern }, { data: blocksLegacy }] = await Promise.all([
    supabase
      .from(DB_TABLES.courtBlocks)
      .select("blocked_time")
      .eq("court_id", courtId)
      .eq("blocked_date", scheduledDate),
    supabase
      .from(DB_TABLES.courtBlocks)
      .select("start_time")
      .eq("court_id", courtId)
      .eq("date", scheduledDate),
  ]);

  const blockStarts = new Set(
    [
      ...(blocksModern ?? []).map((b) =>
        String((b as { blocked_time: string | null }).blocked_time ?? "").trim().slice(0, 5)
      ),
      ...(blocksLegacy ?? []).map((b) =>
        String((b as { start_time: string | null }).start_time ?? "").trim().slice(0, 5)
      ),
    ].filter(Boolean)
  );
  const slotTimeNorm = timeNorm.slice(0, 5);
  if (blockStarts.has(slotTimeNorm)) {
    return { error: "Este horario no está disponible." };
  }

  const dateIso = toIsoDateTime(scheduledDate, timeNorm);

  const [{ data: courtPriceRow, error: priceErr }, { data: slotPriceRow }] = await Promise.all([
    supabase.from(DB_TABLES.courts).select("price").eq("id", courtId).maybeSingle(),
    supabase
      .from(DB_TABLES.courtSchedules)
      .select("price_override")
      .eq("court_id", courtId)
      .is("day_of_week", null)
      .eq("start_time", timeNorm)
      .not("price_override", "is", null)
      .maybeSingle(),
  ]);

  if (priceErr || !courtPriceRow) {
    return { error: "No se pudo obtener el precio del turno." };
  }

  const slotOverride = (slotPriceRow as { price_override?: number | null } | null)?.price_override;
  const baseAmount =
    typeof slotOverride === "number" && slotOverride > 0
      ? slotOverride
      : Number((courtPriceRow as { price: number | null }).price ?? 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { error: "Precio del turno inválido." };
  }

  const depositAmount =
    paymentMethod === "mercadopago" ? resolveDepositCharge(baseAmount, clubDepositType, clubDepositValue) : 0;
  const isPartialDeposit = paymentMethod === "mercadopago" && depositAmount < baseAmount;

  const payStatus =
    paymentMethod === "cash" ? "cash_pending" : paymentMethod === "transfer" ? "transfer_pending" : "pending";
  const financialStatus = "unpaid";
  const amountPaid = 0;
  const amountPending = baseAmount;

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      owner_id: user.id,
      scheduled_date: scheduledDate,
      scheduled_time: timeNorm,
      duration_minutes: Number(durationMinutes),
      total_price: baseAmount,
      payment_status: payStatus,
      amount_paid: amountPaid,
      amount_pending: amountPending,
      financial_status: financialStatus,
      match_status: "reserved",
      match_type: "reservation",
      is_competitive: false,
      visibility: "privado",
      location_name: clubName || "Club",
      date: dateIso,
      gender_category: "mixto",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMatchSlotConflictError(error)) {
      return { error: "Este horario ya fue reservado. Elegí otro." };
    }
    return { error: "No se pudo crear la reserva. Intentá de nuevo." };
  }

  const methodLabel =
    paymentMethod === "mercadopago" ? "Mercado Pago" : paymentMethod === "cash" ? "Efectivo" : "Transferencia";
  if (clubId) {
    const title =
      paymentMethod === "cash"
        ? "💵 Cobro pendiente"
        : paymentMethod === "transfer"
          ? "📅 Nueva reserva"
          : "📅 Nueva reserva";
    const body =
      paymentMethod === "cash"
        ? `${payerName || "Un jugador"} debe pagar en efectivo para ${courtName || "Cancha"} el ${scheduledDate} a las ${timeNorm}.`
        : `${payerName || "Un jugador"} reservó ${courtName || "Cancha"} para el ${scheduledDate} a las ${timeNorm}. Método: ${methodLabel}.`;
    await notifyClubOwner(supabase, clubId, {
      title,
      body,
      match_id: data.id,
    });
  }

  const { error: participantError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: data.id,
    player_id: user.id,
    team: 1,
  });
  if (participantError) {
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: "No se pudo crear la reserva. Intentá de nuevo." };
  }

  if (paymentMethod === "cash" || paymentMethod === "transfer") {
    const notifTitle =
      paymentMethod === "cash" ? "Reserva con efectivo" : "Reserva con transferencia";
    const notifBody =
      paymentMethod === "cash"
        ? `Tu turno en ${courtName || "Cancha"} el ${scheduledDate} a las ${timeNorm} quedó registrado. Pagás en efectivo al llegar al club.`
        : `Tu turno en ${courtName || "Cancha"} el ${scheduledDate} a las ${timeNorm} quedó registrado. Enviá el comprobante de transferencia al club.`;
    await createNotification(supabase, {
      user_id: user.id,
      type: "reservation_confirmed",
      title: notifTitle,
      body: notifBody,
      match_id: data.id,
    });
    redirect(`/reservas/confirmacion?id=${encodeURIComponent(data.id)}&method=${paymentMethod}`);
  }

  await createNotification(supabase, {
    user_id: user.id,
    type: "reservation_confirmed",
    title: "Reserva pendiente de pago",
    body: isPartialDeposit
      ? `Tu turno en ${courtName || "Cancha"} para el ${scheduledDate} a las ${timeNorm} quedó pendiente hasta acreditar la seña.`
      : `Tu turno en ${courtName || "Cancha"} para el ${scheduledDate} a las ${timeNorm} quedó pendiente hasta acreditar el pago.`,
    match_id: data.id,
  });

  const mp = await createMPPreference({
    matchId: data.id,
    amount: depositAmount,
    clubName: clubName || "Club",
    courtName: courtName || "Cancha",
    date: scheduledDate,
    userId: user.id,
    externalReference: `${data.id}__${user.id}`,
    payerEmail: user.email ?? "",
    payerFirstName,
    payerLastName,
    clubAccessToken,
  });

  if ("error" in mp) {
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: mp.error };
  }

  const { error: payErr } = await supabase.from(DB_TABLES.payments).insert({
    match_id: data.id,
    user_id: user.id,
    mp_preference_id: mp.prefId,
    status: "pending",
    amount: mp.total,
    payment_method: "mercadopago",
  });

  if (payErr) {
    console.error("[mp] insert payment", payErr);
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return { error: "No se pudo registrar el pago. Intentá de nuevo." };
  }

  redirect(mp.initPoint);
}
