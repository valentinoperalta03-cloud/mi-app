"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient } from "@/utils/supabase/server";

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

  // Precio: precio por franja si está configurado para esa hora, si no el
  // precio base de la cancha (mismo criterio que admin/canchas/page.tsx).
  const { data: courtRow } = await supabase.from(DB_TABLES.courts).select("price").eq("id", courtId).maybeSingle();
  const { data: priceRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,price_override")
    .eq("court_id", courtId)
    .is("day_of_week", null);
  const override = ((priceRows ?? []) as Array<{ start_time: string | null; price_override: number | null }>).find(
    (r) => String(r.start_time ?? "").slice(0, 5) === time
  )?.price_override;
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

