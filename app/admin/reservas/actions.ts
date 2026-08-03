"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient } from "@/utils/supabase/server";

export type ManualBlockState = { success: boolean; message: string };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createManualCourtBlockAction(
  _prev: ManualBlockState,
  formData: FormData
): Promise<ManualBlockState> {
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const startTime = getField(formData, "start_time");

  if (!courtId || !date || !startTime) {
    return { success: false, message: "Completa cancha, fecha y hora." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { success: false, message: "Sesion invalida." };
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { success: false, message: "La cancha no pertenece a tu club." };
  }

  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: startTime.length >= 5 ? startTime.slice(0, 5) : startTime,
    blocked_date: date,
    blocked_time: startTime.length >= 5 ? startTime.slice(0, 5) : startTime,
    reason: null,
    created_by: ctx.userId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/club/gestion");
  return { success: true, message: "Bloqueo creado." };
}

function normalizeHour(value: string) {
  const v = value.trim();
  return v.length >= 5 ? v.slice(0, 5) : v;
}

async function toggleCourtBlockRow(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  courtId: string;
  date: string;
  time: string;
  reason: string;
  userId: string;
}) {
  const { supabase, courtId, date, time, reason, userId } = params;
  const existing = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("id")
    .eq("court_id", courtId)
    .eq("blocked_date", date)
    .eq("blocked_time", time)
    .maybeSingle();
  if (existing.error) {
    return { blocked: false, error: existing.error };
  }

  if (existing.data?.id) {
    const { error } = await supabase.from(DB_TABLES.courtBlocks).delete().eq("id", existing.data.id);
    return { blocked: false, error };
  }

  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: time,
    blocked_date: date,
    blocked_time: time,
    reason: reason || null,
    created_by: userId,
  });
  return { blocked: true, error };
}

export async function blockCourtSlot(courtId: string, date: string, time: string, reason?: string) {
  if (!courtId || !date || !time) {
    return { success: false, message: "Datos incompletos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { success: false, message: "Sesion invalida." };
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { success: false, message: "La cancha no pertenece a tu club." };
  }

  const toggled = await toggleCourtBlockRow({
    supabase,
    courtId,
    date,
    time: normalizeHour(time),
    reason: String(reason ?? "").trim(),
    userId: ctx.userId,
  });
  if (toggled.error) {
    return { success: false, message: toggled.error.message };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/club/gestion");
  return { success: true, message: toggled.blocked ? "Horario bloqueado." : "Bloqueo removido." };
}

export async function blockCourtSlotAction(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const time = getField(formData, "time");
  const reason = getField(formData, "reason");
  await blockCourtSlot(courtId, date, time, reason);
  redirect(`/admin/reservas?date=${encodeURIComponent(date)}`);
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

export async function addClubClosedDayAction(formData: FormData): Promise<void> {
  const closedDate = getField(formData, "closed_date");
  const reason = getField(formData, "reason");
  const returnDate = getField(formData, "return_date") || closedDate;
  if (!closedDate || !/^\d{4}-\d{2}-\d{2}$/.test(closedDate)) {
    redirect(`/admin/reservas?date=${encodeURIComponent(returnDate)}`);
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.length) redirect("/login");

  const clubId = ctx.clubIds[0];
  const { error } = await supabase.from(DB_TABLES.clubClosedDays).insert({
    club_id: clubId,
    closed_date: closedDate,
    reason: reason || null,
  });
  if (error) {
    redirect(`/admin/reservas?date=${encodeURIComponent(returnDate)}&closed_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/reservas");
  redirect(`/admin/reservas?date=${encodeURIComponent(returnDate)}`);
}

export async function removeClubClosedDayAction(formData: FormData): Promise<void> {
  const id = getField(formData, "closed_day_id");
  const returnDate = getField(formData, "return_date");
  if (!id) redirect(`/admin/reservas?date=${encodeURIComponent(returnDate || "")}`);

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.length) redirect("/login");

  const clubId = ctx.clubIds[0];
  const { data: row } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id")
    .eq("id", id)
    .eq("club_id", clubId)
    .maybeSingle();
  if (!row) {
    redirect(`/admin/reservas?date=${encodeURIComponent(returnDate || "")}`);
  }

  await supabase.from(DB_TABLES.clubClosedDays).delete().eq("id", id).eq("club_id", clubId);
  revalidatePath("/admin/reservas");
  redirect(`/admin/reservas?date=${encodeURIComponent(returnDate || "")}`);
}
