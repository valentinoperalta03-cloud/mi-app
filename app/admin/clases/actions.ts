"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import type { PracticeModalityKey, PracticeRecurrenceKey } from "@/lib/practice-constants";
import { createClient } from "@/utils/supabase/server";

export type CreatePracticeState = { ok: boolean; message: string; id?: string };

function parseWeeklyDays(formData: FormData): number[] {
  const raw = formData.getAll("weekly_days");
  return raw
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

export async function createPracticeAction(
  _prev: CreatePracticeState,
  formData: FormData
): Promise<CreatePracticeState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0) return { ok: false, message: "Primero configurá tu club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId)) return { ok: false, message: "Club inválido." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const recurrenceType = String(formData.get("recurrence_type") ?? "").trim() as PracticeRecurrenceKey;
  const modality = String(formData.get("modality") ?? "group").trim() as PracticeModalityKey;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim().slice(0, 8);
  const maxSpots = Number(formData.get("max_spots") ?? 4);
  const priceBase = Number(formData.get("price_base") ?? 0);
  const courtIdRaw = String(formData.get("court_id") ?? "").trim();
  const coachIdRaw = String(formData.get("coach_id") ?? "").trim();
  const levelMinRaw = String(formData.get("level_min") ?? "").trim();
  const levelMaxRaw = String(formData.get("level_max") ?? "").trim();
  const weeklyDays = parseWeeklyDays(formData);

  if (!title) return { ok: false, message: "Título obligatorio." };
  if (!["once", "weekly"].includes(recurrenceType)) return { ok: false, message: "Tipo de fecha inválido." };
  if (!["individual", "group"].includes(modality)) return { ok: false, message: "Modalidad inválida." };
  if (!startDate || !startTime) return { ok: false, message: "Completá fecha y hora." };
  const end = recurrenceType === "once" ? startDate : endDate;
  if (!end) return { ok: false, message: "Completá fecha de fin." };
  if (recurrenceType === "weekly" && weeklyDays.length === 0) {
    return { ok: false, message: "Elegí al menos un día de la semana." };
  }
  if (!Number.isFinite(maxSpots) || maxSpots < 1) return { ok: false, message: "Cupos inválidos." };
  if (!Number.isFinite(priceBase) || priceBase < 0) return { ok: false, message: "Precio inválido." };

  const level_min = levelMinRaw === "" ? null : Number(levelMinRaw);
  const level_max = levelMaxRaw === "" ? null : Number(levelMaxRaw);

  const { data: inserted, error } = await supabase
    .from(DB_TABLES.practices)
    .insert({
      club_id: clubId,
      title,
      description,
      modality,
      recurrence_type: recurrenceType,
      start_date: startDate,
      end_date: end,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      weekly_days: recurrenceType === "weekly" ? weeklyDays : [],
      max_spots: Math.floor(maxSpots),
      price_base: priceBase,
      court_id: courtIdRaw || null,
      coach_id: coachIdRaw || null,
      level_min,
      level_max,
      created_by: ctx.userId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, message: error?.message ?? "No se pudo crear la clase." };

  revalidatePath("/admin/clases");
  redirect(`/admin/clases/${(inserted as { id: string }).id}`);
}

export type CoachState = { ok: boolean; message: string };

export async function createPracticeCoachAction(
  _prev: CoachState,
  formData: FormData
): Promise<CoachState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0) return { ok: false, message: "Sin club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId)) return { ok: false, message: "Club inválido." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Nombre obligatorio." };

  const { error } = await supabase.from(DB_TABLES.practiceCoaches).insert({ club_id: clubId, name });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/clases");
  revalidatePath("/admin/clases/nuevo");
  return { ok: true, message: "Profesor agregado." };
}
