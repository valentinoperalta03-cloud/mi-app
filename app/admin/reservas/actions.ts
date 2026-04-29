"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkCancellationLimit } from "@/lib/cancellation-guard";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export type ManualBlockState = { success: boolean; message: string };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function adminCancelReservation(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  if (!matchId) {
    redirect("/admin/reservas");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }

  const { data: row, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("court_id,match_type,owner_id")
    .eq("id", matchId)
    .maybeSingle();

  if (fetchErr || !row) {
    redirect("/admin/reservas");
  }

  const typed = row as { court_id: string; match_type: string | null; owner_id: string | null };
  if (!ctx.courtIds.includes(typed.court_id) || typed.match_type !== "reservation") {
    redirect("/admin/reservas");
  }

  if (typed.owner_id) {
    const cancellationGuard = await checkCancellationLimit(supabase, typed.owner_id);
    if (!cancellationGuard.allowed) {
      redirect(`/admin/reservas?error=${encodeURIComponent("cancel_limit")}`);
    }
  }

  const { error } = await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", matchId);

  if (error) {
    redirect("/admin/reservas");
  }

  if (typed.owner_id) {
    const tpl = NOTIFICATION_TEMPLATES.reservation_cancelled("la cancha");
    await createNotification(supabase, {
      user_id: typed.owner_id,
      type: "reservation_cancelled",
      title: tpl.title,
      body: "Tu reserva fue cancelada por la administración del club.",
      match_id: matchId,
    });
  }

  revalidatePath("/admin/reservas");
  redirect("/admin/reservas");
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

  const modernFilter = supabase
    .from(DB_TABLES.courtBlocks)
    .select("id")
    .eq("court_id", courtId)
    .eq("blocked_date", date)
    .eq("blocked_time", time)
    .maybeSingle();
  const modernExisting = await modernFilter;

  if (!modernExisting.error) {
    if (modernExisting.data?.id) {
      const { error } = await supabase.from(DB_TABLES.courtBlocks).delete().eq("id", modernExisting.data.id);
      return { blocked: false, error };
    }
    const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
      court_id: courtId,
      blocked_date: date,
      blocked_time: time,
      reason: reason || null,
      created_by: userId,
    });
    return { blocked: true, error };
  }

  const legacyExisting = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("id")
    .eq("court_id", courtId)
    .eq("date", date)
    .eq("start_time", time)
    .maybeSingle();
  if (legacyExisting.data?.id) {
    const { error } = await supabase.from(DB_TABLES.courtBlocks).delete().eq("id", legacyExisting.data.id);
    return { blocked: false, error };
  }
  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: time,
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
    .select("id,court_id,match_type,payment_status")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as { id: string; court_id: string; match_type: string | null; payment_status: string | null } | null;
  if (!typed || typed.match_type !== "reservation" || !ctx.courtIds.includes(typed.court_id)) {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }
  if (String(typed.payment_status ?? "").toLowerCase() !== "paid") {
    redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}`);
  }

  await supabase
    .from(DB_TABLES.matches)
    .update({ payment_status: "refund_requested" })
    .eq("id", matchId);
  await supabase.from(DB_TABLES.payments).update({ status: "refund_requested" }).eq("match_id", matchId);

  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas/reembolsos");
  redirect(`/admin/reservas?date=${encodeURIComponent(date || "")}&selected=${encodeURIComponent(matchId)}`);
}
