"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { resolveOfflinePaymentConfirmation } from "@/lib/offline-payments";
import { assertMatchTransition } from "@/lib/state-machines/match-states";
import { assertMatchPaymentStatusTransition } from "@/lib/state-machines/payment-states";
import { createNotification } from "@/lib/notifications";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type OfflineMethod = "cash" | "transfer";

function getMatchId(formData: FormData) {
  return String(formData.get("match_id") ?? "").trim();
}

function getRegistrationId(formData: FormData) {
  return String(formData.get("registration_id") ?? "").trim();
}

/** Metodo a registrar cuando se confirma el pago total de un match sin que el admin lo elija explicitamente. */
function inferOfflineMethod(paymentStatus: string): OfflineMethod {
  return paymentStatus === "transfer_pending" ? "transfer" : "cash";
}

/**
 * Cierra el cobro de un match por el total (mismo resultado que el webhook de MP
 * cuando aprueba un pago): payment_status=paid, match_status=reserved, inserta
 * en payments y notifica al dueño del turno. Compartido por confirmOfflineCobro
 * (form, un solo paso) y registrarPagoParcial (cuando el ultimo abono completa el total).
 */
async function finalizeFullMatchPayment(
  svc: SupabaseClient,
  match: {
    id: string;
    owner_id: string;
    match_status: string | null;
    payment_status: string | null;
    total_price: number | null;
  },
  method: OfflineMethod
): Promise<{ ok: boolean; error?: string }> {
  const pay = String(match.payment_status ?? "").toLowerCase();
  const totalPrice = Number(match.total_price ?? 0);
  const { amountPaid, amountPending, financialStatus } = resolveOfflinePaymentConfirmation(totalPrice);
  const ownerId = String(match.owner_id);
  // Igual que el webhook de MP (app/api/mp/webhook/route.ts): confirmar el pago
  // del organizador reserva el turno sin importar el tipo de partido.
  const nextMatchStatus = "reserved";

  try {
    assertMatchPaymentStatusTransition(pay, "paid", { matchId: match.id, trigger: "admin.cobros.confirm" });
    assertMatchTransition(match.match_status, nextMatchStatus, {
      matchId: match.id,
      trigger: "admin.cobros.confirm",
    });
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado del turno." };
  }

  const { error: upMatchErr } = await svc
    .from(DB_TABLES.matches)
    .update({
      payment_status: "paid",
      match_status: nextMatchStatus,
      amount_paid: amountPaid,
      amount_pending: amountPending,
      financial_status: financialStatus,
    })
    .eq("id", match.id);
  if (upMatchErr) return { ok: false, error: "No se pudo confirmar el cobro." };

  const { error: payInsErr } = await svc.from(DB_TABLES.payments).insert({
    match_id: match.id,
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
    return { ok: false, error: "No se pudo registrar el pago." };
  }

  await createNotification(svc, {
    user_id: ownerId,
    type: "payment_approved",
    title: "Tu pago fue confirmado ✓",
    body: "El club confirmó tu pago. ¡Nos vemos en la cancha!",
    match_id: match.id,
  });

  return { ok: true };
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
  // "pending" se agrega porque el jugador puede haber elegido Mercado Pago y no
  // haber terminado el pago online: el club igual puede cobrarle en persona.
  if (pay !== "cash_pending" && pay !== "transfer_pending" && pay !== "pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Este cobro ya no está pendiente."));
  }

  const svc = createServiceClient();
  const result = await finalizeFullMatchPayment(
    svc,
    match as { id: string; owner_id: string; match_status: string | null; payment_status: string | null; total_price: number | null },
    inferOfflineMethod(pay)
  );
  if (!result.ok) {
    redirect("/admin/cobros?error=" + encodeURIComponent(result.error ?? "No se pudo confirmar el cobro."));
  }

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas");
  redirect("/admin/cobros?ok=1");
}

export async function registrarPagoParcial(input: {
  matchId: string;
  monto: number;
  metodo: OfflineMethod;
}): Promise<{ ok: boolean; error?: string }> {
  const matchId = String(input.matchId ?? "").trim();
  const monto = Number(input.monto);
  const metodo = input.metodo === "transfer" ? "transfer" : "cash";

  if (!matchId) return { ok: false, error: "Falta el turno." };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: "Ingresá un monto válido." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.courtIds.length) return { ok: false, error: "No autorizado." };

  const { data: match, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, court_id, payment_status, match_status, total_price, amount_paid")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !match) return { ok: false, error: "No se encontró el turno." };

  const row = match as {
    id: string;
    owner_id: string;
    court_id: string;
    payment_status: string | null;
    match_status: string | null;
    total_price: number | null;
    amount_paid: number | null;
  };

  if (!ctx.courtIds.includes(row.court_id)) return { ok: false, error: "No autorizado." };

  const pay = String(row.payment_status ?? "").toLowerCase();
  if (pay !== "cash_pending" && pay !== "transfer_pending" && pay !== "pending") {
    return { ok: false, error: "Este cobro ya no está pendiente." };
  }

  const totalPrice = Number(row.total_price ?? 0);
  const currentPaid = Number(row.amount_paid ?? 0);
  const nuevoAmountPaid = currentPaid + monto;

  const svc = createServiceClient();

  if (nuevoAmountPaid >= totalPrice) {
    const result = await finalizeFullMatchPayment(svc, row, metodo);
    if (!result.ok) return result;
  } else {
    const amountPending = Math.max(totalPrice - nuevoAmountPaid, 0);
    const { error: upErr } = await svc
      .from(DB_TABLES.matches)
      .update({
        amount_paid: nuevoAmountPaid,
        amount_pending: amountPending,
        financial_status: "partially_paid",
      })
      .eq("id", matchId);
    if (upErr) return { ok: false, error: "No se pudo registrar el pago." };

    const { error: payErr } = await svc.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: row.owner_id,
      status: "approved",
      amount: monto,
      payment_method: metodo,
      mp_preference_id: null,
      mp_payment_id: "club_counter_partial",
      updated_at: new Date().toISOString(),
    });
    if (payErr) {
      console.error("[cobros] partial payment insert", payErr);
      return { ok: false, error: "No se pudo registrar el pago." };
    }
  }

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas");
  return { ok: true };
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
  if (pay !== "cash_pending" && pay !== "transfer_pending" && pay !== "pending") {
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
  const payAmount = Number(raw.amount ?? 0) || Math.round(priceBase * 100) / 100;
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

export async function confirmTournamentOfflineCobro(formData: FormData) {
  const registrationId = getRegistrationId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !registrationId) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: reg, error: rErr } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, tournament_id, payment_status, total_price, tournaments!inner(club_id, name)")
    .eq("id", registrationId)
    .maybeSingle();

  if (rErr || !reg) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró la inscripción."));
  }

  const raw = reg as Record<string, unknown>;
  const pay = String(raw.payment_status ?? "").toLowerCase();
  if (pay !== "pending") {
    redirect("/admin/cobros?error=" + encodeURIComponent("Esta inscripción ya no está pendiente."));
  }

  const tournamentPack = raw.tournaments;
  const tournament = (Array.isArray(tournamentPack) ? tournamentPack[0] : tournamentPack) as {
    club_id?: string;
    name?: string;
  } | null;
  const clubId = String(tournament?.club_id ?? "").trim();
  if (!clubId || !ctx.clubIds.includes(clubId)) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const totalPrice = Number(raw.total_price ?? 0);
  const playerId = String(raw.player1_id);
  const svc = createServiceClient();

  const { error: upErr } = await svc
    .from(DB_TABLES.tournamentRegistrations)
    .update({
      payment_status: "approved",
      mp_payment_id: "club_counter",
      amount: totalPrice,
      amount_paid: totalPrice,
      amount_pending: 0,
      financial_status: "fully_paid",
    })
    .eq("id", registrationId);
  if (upErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo confirmar el cobro."));
  }

  await createNotification(svc, {
    user_id: playerId,
    type: "payment_approved",
    title: "¡Pago confirmado!",
    body: `El club confirmó el pago de tu inscripción al torneo "${String(tournament?.name ?? "Torneo").trim()}".`,
  });

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/torneos");
  redirect("/admin/cobros?ok=1");
}

export async function confirmRemainingBalanceAction(formData: FormData) {
  const matchId = getMatchId(formData);
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !matchId || !ctx.courtIds.length) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const { data: match, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, court_id, total_price, financial_status, amount_pending")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se encontró el turno."));
  }

  const courtId = String((match as { court_id: string }).court_id);
  if (!ctx.courtIds.includes(courtId)) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No autorizado."));
  }

  const financialStatus = String((match as { financial_status: string | null }).financial_status ?? "");
  const amountPending = Number((match as { amount_pending: number | null }).amount_pending ?? 0);
  if (financialStatus !== "partially_paid" || amountPending <= 0) {
    redirect("/admin/cobros?error=" + encodeURIComponent("Este turno no tiene saldo pendiente."));
  }

  const totalPrice = Number((match as { total_price: number | null }).total_price ?? 0);
  const svc = createServiceClient();

  const { error: upErr } = await svc
    .from(DB_TABLES.matches)
    .update({
      amount_paid: totalPrice,
      amount_pending: 0,
      financial_status: "fully_paid",
    })
    .eq("id", matchId);
  if (upErr) {
    redirect("/admin/cobros?error=" + encodeURIComponent("No se pudo registrar el saldo."));
  }

  revalidatePath("/admin/cobros");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/finanzas");
  redirect("/admin/cobros?saldo=1");
}
