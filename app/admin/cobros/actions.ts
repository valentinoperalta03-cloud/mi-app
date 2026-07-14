"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { resolveOfflinePaymentConfirmation } from "@/lib/offline-payments";
import { assertMatchTransition } from "@/lib/state-machines/match-states";
import { assertMatchPaymentStatusTransition } from "@/lib/state-machines/payment-states";
import { createNotification } from "@/lib/notifications";
import { practiceClubPadelibreDebt } from "@/lib/practice-offline";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getMatchId(formData: FormData) {
  return String(formData.get("match_id") ?? "").trim();
}

function getRegistrationId(formData: FormData) {
  return String(formData.get("registration_id") ?? "").trim();
}

export async function confirmOfflineCobro(formData: FormData) {
  const matchId = getMatchId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !matchId || !ctx.courtIds.length) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: match, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, court_id, payment_status, match_status, match_type, total_price")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró el turno."));
  }

  const courtId = String((match as { court_id: string }).court_id);
  if (!ctx.courtIds.includes(courtId)) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const pay = String((match as { payment_status: string | null }).payment_status ?? "").toLowerCase();
  if (pay !== "cash_pending" && pay !== "transfer_pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Este cobro ya no está pendiente."));
  }

  const method = pay === "cash_pending" ? "cash" : "transfer";
  const totalPrice = Number((match as { total_price: number | null }).total_price ?? 0);
  const { amountPaid, amountPending, financialStatus } = resolveOfflinePaymentConfirmation(totalPrice);
  const ownerId = String((match as { owner_id: string }).owner_id);
  const matchType = String((match as { match_type?: string | null }).match_type ?? "");
  const prevMs = String((match as { match_status: string | null }).match_status ?? "").toLowerCase();
  const nextMatchStatus = matchType === "reservation" ? "reserved" : prevMs || "scheduled";

  try {
    assertMatchPaymentStatusTransition(pay, "paid", { matchId, trigger: "admin.cobros.confirm" });
    assertMatchTransition((match as { match_status: string | null }).match_status, nextMatchStatus, {
      matchId,
      trigger: "admin.cobros.confirm",
    });
  } catch {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo actualizar el estado del turno."));
  }

  const svc = createServiceClient();

  const { error: upMatchErr } = await svc
    .from(DB_TABLES.matches)
    .update({
      payment_status: "paid",
      match_status: nextMatchStatus,
      amount_paid: amountPaid,
      amount_pending: amountPending,
      financial_status: financialStatus,
    })
    .eq("id", matchId);
  if (upMatchErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo confirmar el cobro."));
  }

  const { error: payInsErr } = await svc.from(DB_TABLES.payments).insert({
    match_id: matchId,
    user_id: ownerId,
    status: "approved",
    amount: amountPaid,
    payment_method: method,
    mp_preference_id: null,
    mp_payment_id: "club_counter",
    updated_at: new Date().toISOString(),
  });
  if (payInsErr) {
    console.error("[cobros] payment insert", payInsErr);
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo registrar el pago."));
  }

  await createNotification(svc, {
    user_id: ownerId,
    type: "payment_approved",
    title: "Tu pago fue confirmado ✓",
    body: "El club confirmó tu pago. ¡Nos vemos en la cancha!",
    match_id: matchId,
  });

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas");
  redirect("/admin/cobros?ok=1");
}

export async function markOfflineNoShow(formData: FormData) {
  const matchId = getMatchId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !matchId || !ctx.courtIds.length) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: match, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, court_id, payment_status, match_status")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró el turno."));
  }

  const courtId = String((match as { court_id: string }).court_id);
  if (!ctx.courtIds.includes(courtId)) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const pay = String((match as { payment_status: string | null }).payment_status ?? "").toLowerCase();
  if (pay !== "cash_pending" && pay !== "transfer_pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Este turno ya no está pendiente de cobro."));
  }

  try {
    assertMatchPaymentStatusTransition(pay, "no_show", { matchId, trigger: "admin.cobros.no_show" });
    assertMatchTransition((match as { match_status: string | null }).match_status, "cancelled", {
      matchId,
      trigger: "admin.cobros.no_show",
    });
  } catch {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo actualizar el estado."));
  }

  const svc = createServiceClient();
  const ownerId = String((match as { owner_id: string }).owner_id);

  const { error: upErr } = await svc
    .from(DB_TABLES.matches)
    .update({ payment_status: "no_show", match_status: "cancelled" })
    .eq("id", matchId);
  if (upErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo registrar la ausencia."));
  }

  await createNotification(svc, {
    user_id: ownerId,
    type: "reservation_cancelled",
    title: "Turno cancelado",
    body: "El club indicó que no te presentaste al turno y se canceló la reserva.",
    match_id: matchId,
  });

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/reservas");
  redirect("/admin/cobros?ok=1");
}

export async function confirmPracticeOfflineCobro(formData: FormData) {
  const registrationId = getRegistrationId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !registrationId) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: reg, error: rErr } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select(
      "id, player_id, payment_status, payment_method, amount, session_id, practice_sessions!inner(session_date, start_time, practice_id, practices!inner(title, club_id, price_base))"
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (rErr || !reg) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró la inscripción."));
  }

  const raw = reg as Record<string, unknown>;
  const pay = String(raw.payment_status ?? "").toLowerCase();
  if (pay !== "cash_pending" && pay !== "transfer_pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Este cobro ya no está pendiente."));
  }

  const sessionPack = raw.practice_sessions;
  const sessionRow = Array.isArray(sessionPack) ? sessionPack[0] : sessionPack;
  const practicePack = (sessionRow as { practices?: unknown } | null)?.practices;
  const practice = (Array.isArray(practicePack) ? practicePack[0] : practicePack) as {
    title?: string;
    club_id?: string;
    price_base?: number;
  } | null;
  const clubId = String(practice?.club_id ?? "").trim();
  if (!clubId || !ctx.clubIds.includes(clubId)) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const method = pay === "cash_pending" ? "cash" : "transfer";
  const priceBase = Number(practice?.price_base ?? 0);
  const payAmount = Number(raw.amount ?? 0) || Math.round((priceBase * 1.05) * 100) / 100;
  const playerId = String(raw.player_id);
  const now = new Date().toISOString();
  const svc = createServiceClient();

  const { error: upErr } = await svc
    .from(DB_TABLES.practiceRegistrations)
    .update({
      payment_status: "approved",
      payment_method: method,
      confirmed_at: now,
      amount: payAmount,
    })
    .eq("id", registrationId);
  if (upErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo confirmar el cobro."));
  }

  const debtAmount = practiceClubPadelibreDebt(priceBase);
  const { error: debtErr } = await svc.from(DB_TABLES.clubDebts).insert({
    club_id: clubId,
    match_id: null,
    practice_registration_id: registrationId,
    amount: debtAmount,
    payment_method: method,
    status: "pending",
    confirmed_at: now,
  });
  if (debtErr) {
    console.error("[cobros] practice club_debts insert", debtErr);
  }

  const sessionDate = String((sessionRow as { session_date?: string } | null)?.session_date ?? "");
  const title = String(practice?.title ?? "Clase").trim();
  await createNotification(svc, {
    user_id: playerId,
    type: "payment_approved",
    title: "¡Inscripción confirmada!",
    body: `El club confirmó tu pago para la clase "${title}"${sessionDate ? ` (${sessionDate})` : ""}.`,
  });

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/clases");
  revalidatePath("/clases");
  revalidatePath(`/clases/${String(raw.session_id)}`);
  redirect("/admin/cobros?ok=1");
}

export async function markPracticeOfflineNoShow(formData: FormData) {
  const registrationId = getRegistrationId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !registrationId) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: reg, error: rErr } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select("id, player_id, payment_status, session_id, practice_sessions!inner(practices!inner(club_id, title))")
    .eq("id", registrationId)
    .maybeSingle();

  if (rErr || !reg) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró la inscripción."));
  }

  const raw = reg as Record<string, unknown>;
  const pay = String(raw.payment_status ?? "").toLowerCase();
  if (pay !== "cash_pending" && pay !== "transfer_pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Esta inscripción ya no está pendiente."));
  }

  const sessionPack = raw.practice_sessions;
  const sessionRow = Array.isArray(sessionPack) ? sessionPack[0] : sessionPack;
  const practicePack = (sessionRow as { practices?: unknown } | null)?.practices;
  const practice = (Array.isArray(practicePack) ? practicePack[0] : practicePack) as {
    club_id?: string;
    title?: string;
  } | null;
  if (!practice?.club_id || !ctx.clubIds.includes(String(practice.club_id))) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const svc = createServiceClient();
  const playerId = String(raw.player_id);
  const { error: upErr } = await svc
    .from(DB_TABLES.practiceRegistrations)
    .update({ payment_status: "cancelled" })
    .eq("id", registrationId);
  if (upErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo cancelar la inscripción."));
  }

  await createNotification(svc, {
    user_id: playerId,
    type: "reservation_cancelled",
    title: "Inscripción cancelada",
    body: `El club canceló tu inscripción a la clase "${String(practice.title ?? "Clase").trim()}".`,
  });

  revalidatePath("/admin/cobros");
  revalidatePath("/clases");
  revalidatePath(`/clases/${String(raw.session_id)}`);
  redirect("/admin/cobros?ok=1");
}
