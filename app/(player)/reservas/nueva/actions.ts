"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { createClient } from "@/utils/supabase/server";

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

async function getServerOrigin(): Promise<string> {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (() => {
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const proto = h.get("x-forwarded-proto") ?? "http";
      return host ? `${proto}://${host}` : "http://localhost:3000";
    })()
  );
}

async function requestMercadoPagoPreference(payload: {
  match_id: string;
  amount: number;
  club_name: string;
  court_name: string;
  date: string;
}): Promise<{ init_point?: string; error?: string }> {
  const origin = await getServerOrigin();
  const jar = await cookies();
  const cookieStr = jar.getAll().map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
  const res = await fetch(`${origin}/api/mp/create-preference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { init_point?: string; error?: string };
  if (!res.ok) {
    return { error: typeof data.error === "string" ? data.error : "No se pudo iniciar el pago con Mercado Pago." };
  }
  if (!data.init_point) {
    return { error: "Mercado Pago no devolvió un enlace de pago." };
  }
  return { init_point: data.init_point };
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

  const timeNorm = scheduledTime.length >= 5 ? scheduledTime.slice(0, 5) : scheduledTime;
  const slotStart = clockToMinutes(timeNorm);
  const slotDur = Number(durationMinutes);
  if (!Number.isFinite(slotDur) || slotDur <= 0) {
    return { error: "Duración inválida." };
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
    const shouldBlockSlot = !isReservation || (matchStatus === "reserved" && paymentStatus === "paid");
    if (!shouldBlockSlot) continue;
    const otherStart = clockToMinutes(String(r.scheduled_time ?? "").trim());
    const otherDur =
      r.duration_minutes && Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : 90;
    if (overlaps(slotStart, slotDur, otherStart, otherDur)) {
      return { error: "Este horario ya fue reservado. Elegí otro." };
    }
  }

  const { data: blocks } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("start_time")
    .eq("court_id", courtId)
    .eq("date", scheduledDate);

  for (const b of blocks ?? []) {
    const bt = String((b as { start_time: string | null }).start_time ?? "").trim();
    if (bt && clockToMinutes(bt) === slotStart) {
      return { error: "Este horario no está disponible." };
    }
  }

  const dateIso = toIsoDateTime(scheduledDate, timeNorm);

  const { data: courtPriceRow, error: priceErr } = await supabase
    .from(DB_TABLES.courts)
    .select("price")
    .eq("id", courtId)
    .maybeSingle();

  if (priceErr || !courtPriceRow) {
    return { error: "No se pudo obtener el precio del turno." };
  }

  const baseAmount = Number((courtPriceRow as { price: number | null }).price ?? 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return { error: "Precio del turno inválido." };
  }

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      owner_id: user.id,
      scheduled_date: scheduledDate,
      scheduled_time: timeNorm,
      duration_minutes: Number(durationMinutes),
      total_price: baseAmount,
      payment_status: "pending",
      match_status: "pending",
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
    return { error: "No se pudo crear la reserva. Intentá de nuevo." };
  }

  await createNotification(supabase, {
    user_id: user.id,
    type: "reservation_confirmed",
    title: "Reserva pendiente de pago",
    body: `Tu turno en ${courtName || "Cancha"} para el ${scheduledDate} a las ${timeNorm} quedó pendiente hasta acreditar el pago.`,
    match_id: data.id,
  });

  const mp = await requestMercadoPagoPreference({
    match_id: data.id,
    amount: Math.round(baseAmount / 4),
    club_name: clubName || "Club",
    court_name: courtName || "Cancha",
    date: scheduledDate,
  });

  if (mp.error || !mp.init_point) {
    await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
    return {
      error:
        mp.error ??
        "No pudimos conectar con Mercado Pago. Revisá la configuración o intentá más tarde.",
    };
  }

  redirect(mp.init_point);
}
