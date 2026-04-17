"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type MatchType = "amistoso" | "competitivo";
type Visibility = "publico" | "privado";
type GenderCategory = "masculino" | "femenino" | "mixto";

type ConflictRow = {
  scheduled_time: string | null;
  duration_minutes: number | null;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeMatchType(raw: string): MatchType {
  return raw.toLowerCase().trim() === "competitivo" ? "competitivo" : "amistoso";
}

function normalizeVisibility(raw: string): Visibility {
  return raw.toLowerCase().trim() === "privado" ? "privado" : "publico";
}

function normalizeGenderCategory(raw: string): GenderCategory {
  const value = raw.toLowerCase().trim();
  if (value === "femenino") return "femenino";
  if (value === "mixto") return "mixto";
  return "masculino";
}

function clockToMinutes(clock: string): number {
  const normalized = clock.trim().slice(0, 5);
  const [hours, minutes] = normalized.split(":").map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function overlapsSlot(slotStartMin: number, slotDur: number, otherStartMin: number, otherDur: number): boolean {
  const slotEnd = slotStartMin + slotDur;
  const otherEnd = otherStartMin + otherDur;
  return slotStartMin < otherEnd && otherStartMin < slotEnd;
}

async function getUser() {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
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

export async function crearPartido(formData: FormData): Promise<{ error: string } | void> {
  const courtId = getField(formData, "court_id");
  const scheduledDate = getField(formData, "scheduled_date");
  const scheduledTime = getField(formData, "scheduled_time");
  const durationMinutesRaw = getField(formData, "duration_minutes");
  const matchType = normalizeMatchType(getField(formData, "match_type"));
  const visibility = normalizeVisibility(getField(formData, "visibility"));
  const genderCategory = normalizeGenderCategory(getField(formData, "gender_category"));
  const levelRestricted = getField(formData, "level_restricted") === "true";

  if (!courtId || !scheduledDate || !scheduledTime || !durationMinutesRaw) {
    return { error: "Completá club, cancha, fecha y horario." };
  }

  const durationMinutes = Number.parseInt(durationMinutesRaw, 10);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duración inválida." };
  }

  try {
    const { supabase, user } = await getUser();

    const { data: courtData, error: courtError } = await supabase
      .from(DB_TABLES.courts)
      .select("price, name, clubs!inner(name)")
      .eq("id", courtId)
      .maybeSingle();

    if (courtError || !courtData) {
      return { error: "No se pudo obtener la información de la cancha." };
    }

    const totalPrice = Number((courtData as { price: number | null }).price ?? 0);
    const clubName = String(
      ((courtData as { clubs?: { name?: string | null } | null }).clubs?.name ?? "Club")
    );
    const courtName = String((courtData as { name?: string | null }).name ?? "Cancha");

    const slotStart = clockToMinutes(scheduledTime);
    const { data: conflicts, error: conflictsError } = await supabase
      .from(DB_TABLES.matches)
      .select("scheduled_time,duration_minutes")
      .eq("court_id", courtId)
      .eq("scheduled_date", scheduledDate)
      .neq("match_status", "cancelled");

    if (conflictsError) {
      return { error: "No se pudo validar disponibilidad." };
    }

    for (const row of (conflicts ?? []) as ConflictRow[]) {
      const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
      const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
      if (overlapsSlot(slotStart, durationMinutes, otherStart, otherDur)) {
        return { error: "Ese horario ya no está disponible." };
      }
    }

    const { data, error } = await supabase
      .from(DB_TABLES.matches)
      .insert({
        court_id: courtId,
        owner_id: user.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime.slice(0, 5),
        duration_minutes: Number(durationMinutes),
        total_price: totalPrice,
        payment_status: "pending",
        match_status: "scheduled",
        match_type: matchType,
        is_competitive: matchType === "competitivo",
        visibility,
        gender_category: genderCategory,
        level_restricted: levelRestricted,
        location_name: clubName,
        date: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: "No se pudo crear el partido." };
    }

    const { error: participantError } = await supabase.from(DB_TABLES.matchParticipants).insert({
      match_id: data.id,
      player_id: user.id,
    });

    if (participantError) {
      return { error: "No se pudo crear el partido." };
    }

    const mp = await requestMercadoPagoPreference({
      match_id: data.id,
      amount: Math.round(totalPrice / 4),
      club_name: clubName,
      court_name: courtName,
      date: scheduledDate,
    });

    if (mp.error || !mp.init_point) {
      await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", data.id);
      await supabase.from(DB_TABLES.matches).delete().eq("id", data.id);
      return {
        error:
          mp.error ??
          "No pudimos conectar con Mercado Pago. Revisá la configuración o intentá más tarde.",
      };
    }

    redirect(mp.init_point);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: "No se pudo crear el partido." };
  }
}
