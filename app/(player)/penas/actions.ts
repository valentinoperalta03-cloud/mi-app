"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { isClubMercadoPagoConnected } from "@/lib/club-mp";
import { notifyClubOwner } from "@/lib/club-notify";
import { createNotification } from "@/lib/notifications";
import { refundMercadoPagoPayment } from "@/lib/mercadopago";
import { createPenaMercadoPagoPreference } from "@/lib/mp-pena-preference";
import { normalizePlayerPaymentMethod, type PlayerPaymentMethod } from "@/lib/offline-payments";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type PenaRow = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  max_players: number;
  price_per_player: number;
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  date: string;
  start_time: string;
  cancellation_hours: number;
};

export async function joinPenaAction(
  penaId: string,
  paymentMethod: PlayerPaymentMethod
): Promise<{ ok: boolean; waitlist?: boolean; mpUrl?: string; error?: string }> {
  const method = normalizePlayerPaymentMethod(paymentMethod);
  if (!method) return { ok: false, error: "Elegí un método de pago." };

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión para inscribirte." };

  const service = createServiceClient();
  const { data: p } = await service
    .from(DB_TABLES.penas)
    .select("id, club_id, name, status, max_players, price_per_player, accepts_mp, accepts_cash, accepts_transfer, date, start_time, cancellation_hours")
    .eq("id", penaId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Peña no encontrada." };
  const pena = p as PenaRow;

  if (pena.status !== "published") return { ok: false, error: "Las inscripciones no están abiertas." };
  if (method === "mercadopago" && !pena.accepts_mp) return { ok: false, error: "Esta peña no acepta pago con Mercado Pago." };
  if (method === "cash" && !pena.accepts_cash) return { ok: false, error: "Esta peña no acepta pago en efectivo." };
  if (method === "transfer" && !pena.accepts_transfer) return { ok: false, error: "Esta peña no acepta pago por transferencia." };

  if (method === "mercadopago") {
    const { data: club } = await service
      .from(DB_TABLES.clubs)
      .select("mp_access_token, mp_user_id")
      .eq("id", pena.club_id)
      .maybeSingle();
    if (!isClubMercadoPagoConnected(club as { mp_access_token?: string | null; mp_user_id?: string | null } | null)) {
      return { ok: false, error: "El club no tiene Mercado Pago conectado. Elegí otro método de pago." };
    }
  }

  const { data: existing } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id, status")
    .eq("pena_id", penaId)
    .eq("player_id", user.id)
    .maybeSingle();
  const existingRow = existing as { id: string; status: string } | null;
  if (existingRow && existingRow.status !== "cancelled") {
    return { ok: false, error: "Ya estás inscripto en esta peña." };
  }

  const { count: registeredCount } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("pena_id", penaId)
    .eq("status", "registered");
  const isWaitlist = (registeredCount ?? 0) >= pena.max_players;
  const targetStatus = isWaitlist ? "waitlist" : "registered";

  let registrationId: string;
  if (existingRow) {
    registrationId = existingRow.id;
    const { error: updErr } = await service
      .from(DB_TABLES.penaRegistrations)
      .update({
        status: targetStatus,
        payment_method: method,
        payment_status: "pending",
        amount: method === "mercadopago" ? pena.price_per_player : 0,
        mp_payment_id: null,
      })
      .eq("id", registrationId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { data: inserted, error: insErr } = await service
      .from(DB_TABLES.penaRegistrations)
      .insert({
        pena_id: penaId,
        player_id: user.id,
        status: targetStatus,
        payment_method: method,
        payment_status: "pending",
        amount: method === "mercadopago" ? pena.price_per_player : 0,
      })
      .select("id")
      .single();
    if (insErr || !inserted) return { ok: false, error: insErr?.message ?? "No se pudo crear la inscripción." };
    registrationId = (inserted as { id: string }).id;
  }

  await notifyClubOwner(service, pena.club_id, {
    title: isWaitlist ? "Nuevo anotado en lista de espera" : "Nueva inscripción a peña",
    body: `Un jugador se inscribió a "${pena.name}".`,
  });

  if (isWaitlist) {
    revalidatePath("/penas");
    revalidatePath(`/penas/${penaId}`);
    return { ok: true, waitlist: true };
  }

  if (method === "mercadopago") {
    const { data: club } = await service.from(DB_TABLES.clubs).select("name").eq("id", pena.club_id).maybeSingle();
    const clubName = String((club as { name?: string | null } | null)?.name ?? "Club");
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const pref = await createPenaMercadoPagoPreference({
      penaId,
      registrationId,
      payerUserId: user.id,
      clubName,
      penaName: pena.name,
      payerEmail: user.email ?? undefined,
      backUrls: {
        success: `${base}/penas/${penaId}?pay=ok`,
        failure: `${base}/penas/${penaId}?pay=fail`,
        pending: `${base}/penas/${penaId}?pay=pending`,
      },
    });
    if ("error" in pref) return { ok: false, error: pref.error };

    revalidatePath("/penas");
    revalidatePath(`/penas/${penaId}`);
    return { ok: true, mpUrl: pref.initPoint };
  }

  revalidatePath("/penas");
  revalidatePath(`/penas/${penaId}`);
  return { ok: true };
}

export async function cancelPenaRegistrationAction(registrationId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Iniciá sesión." };

  const service = createServiceClient();
  const { data: reg } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id, pena_id, player_id, status, payment_status, payment_method, mp_payment_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { ok: false, error: "Inscripción no encontrada." };
  const r = reg as {
    id: string;
    pena_id: string;
    player_id: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    mp_payment_id: string | null;
  };
  if (r.player_id !== user.id) return { ok: false, error: "No autorizado." };
  if (r.status === "cancelled") return { ok: false, error: "Esta inscripción ya está cancelada." };

  const { data: p } = await service
    .from(DB_TABLES.penas)
    .select("id, name, date, start_time, cancellation_hours")
    .eq("id", r.pena_id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Peña no encontrada." };
  const pena = p as { id: string; name: string; date: string; start_time: string; cancellation_hours: number };

  const startMs = new Date(`${pena.date}T${pena.start_time.slice(0, 8)}`).getTime();
  const limitMs = startMs - pena.cancellation_hours * 60 * 60 * 1000;
  if (Date.now() > limitMs) {
    return { ok: false, error: `Solo podés cancelar hasta ${pena.cancellation_hours}hs antes del inicio.` };
  }

  if (r.payment_status === "confirmed" && r.payment_method === "mercadopago" && r.mp_payment_id) {
    const result = await refundMercadoPagoPayment(r.mp_payment_id);
    if (!result.ok) return { ok: false, error: "No se pudo reembolsar el pago. Contactá soporte." };
    await service.from(DB_TABLES.penaRegistrations).update({ payment_status: "refunded" }).eq("id", registrationId);
  }

  const wasRegistered = r.status === "registered";
  const { error: cancelErr } = await service.from(DB_TABLES.penaRegistrations).update({ status: "cancelled" }).eq("id", registrationId);
  if (cancelErr) return { ok: false, error: cancelErr.message };

  if (wasRegistered) {
    const { data: nextInLine } = await service
      .from(DB_TABLES.penaRegistrations)
      .select("id, player_id")
      .eq("pena_id", r.pena_id)
      .eq("status", "waitlist")
      .order("registered_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const promoted = nextInLine as { id: string; player_id: string } | null;
    if (promoted) {
      await service.from(DB_TABLES.penaRegistrations).update({ status: "registered" }).eq("id", promoted.id);
      await createNotification(service, {
        user_id: promoted.player_id,
        type: "reservation_confirmed",
        title: "¡Entraste a la peña!",
        body: `Se liberó un lugar en "${pena.name}" y quedaste inscripto.`,
      });
    }
  }

  revalidatePath("/penas");
  revalidatePath(`/penas/${r.pena_id}`);
  return { ok: true };
}
