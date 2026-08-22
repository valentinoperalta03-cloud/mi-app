"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import {
  getCurrentClockInArgentina,
  getTodayYmdInArgentina,
} from "@/lib/datetime-ar";
import { parseClockToMinutes } from "@/lib/court-slots";
import { getUpcomingDatesForDayOfWeek } from "@/lib/fixed-slot-generator";
import type {
  PracticeModalityKey,
  PracticeRecurrenceKey,
} from "@/lib/practice-constants";
import { createClient } from "@/utils/supabase/server";

function getArgentinaNowAtNoon(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

export type CreatePracticeState = { ok: boolean; message: string; id?: string };

function parseWeeklyDays(formData: FormData): number[] {
  const raw = formData.getAll("weekly_days");
  return raw
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

export async function createPracticeAction(
  _prev: CreatePracticeState,
  formData: FormData,
): Promise<CreatePracticeState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0)
    return { ok: false, message: "Primero configurá tu club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId))
    return { ok: false, message: "Club inválido." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const recurrenceType = String(
    formData.get("recurrence_type") ?? "",
  ).trim() as PracticeRecurrenceKey;
  const modality = String(
    formData.get("modality") ?? "group",
  ).trim() as PracticeModalityKey;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "")
    .trim()
    .slice(0, 8);
  const maxSpots = Number(formData.get("max_spots") ?? 4);
  const priceBase = Number(formData.get("price_base") ?? 0);
  const courtIdRaw = String(formData.get("court_id") ?? "").trim();
  const coachIdRaw = String(formData.get("coach_id") ?? "").trim();
  const levelMinRaw = String(formData.get("level_min") ?? "").trim();
  const levelMaxRaw = String(formData.get("level_max") ?? "").trim();
  const weeklyDays = parseWeeklyDays(formData);

  if (!title) return { ok: false, message: "Título obligatorio." };
  if (!["once", "weekly"].includes(recurrenceType))
    return { ok: false, message: "Tipo de fecha inválido." };
  if (!["individual", "group"].includes(modality))
    return { ok: false, message: "Modalidad inválida." };
  if (!startDate || !startTime)
    return { ok: false, message: "Completá fecha y hora." };
  const end = recurrenceType === "once" ? startDate : endDate;
  if (!end) return { ok: false, message: "Completá fecha de fin." };
  if (recurrenceType === "weekly" && weeklyDays.length === 0) {
    return { ok: false, message: "Elegí al menos un día de la semana." };
  }
  if (!Number.isFinite(maxSpots) || maxSpots < 1)
    return { ok: false, message: "Cupos inválidos." };
  if (!Number.isFinite(priceBase) || priceBase < 0)
    return { ok: false, message: "Precio inválido." };

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
      status: "open",
    })
    .select("id")
    .single();

  if (error || !inserted)
    return {
      ok: false,
      message: error?.message ?? "No se pudo crear la clase.",
    };

  revalidatePath("/admin/clases");
  return {
    ok: true,
    message: "Clase publicada.",
    id: (inserted as { id: string }).id,
  };
}

export type CoachState = { ok: boolean; message: string };

export async function createPracticeCoachAction(
  _prev: CoachState,
  formData: FormData,
): Promise<CoachState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0) return { ok: false, message: "Sin club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId))
    return { ok: false, message: "Club inválido." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Nombre obligatorio." };

  const { error } = await supabase
    .from(DB_TABLES.practiceCoaches)
    .insert({ club_id: clubId, name });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/clases");
  return { ok: true, message: "Profesor agregado." };
}

// ---------------------------------------------------------------------------
// Entrenamientos externos: solo registro/bloqueo interno del club vía
// court_blocks (reason='entrenamiento_externo'). No generan matches, no
// tienen jugadores ni notificaciones, y no son visibles para jugadores.
// ---------------------------------------------------------------------------

export type TrainingBlockState = { ok: boolean; message: string };

export async function createTrainingBlockAction(
  _prev: TrainingBlockState,
  formData: FormData,
): Promise<TrainingBlockState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0)
    return { ok: false, message: "Primero configurá tu club." };

  const courtId = String(formData.get("court_id") ?? "").trim();
  const court = ctx.courts.find((c) => c.id === courtId);
  if (!court) return { ok: false, message: "Cancha inválida." };

  const title = String(formData.get("title") ?? "").trim();
  const coach = String(formData.get("coach") ?? "").trim() || null;
  const modality = String(formData.get("modality") ?? "").trim() || null;
  const recurrence = String(formData.get("recurrence") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "")
    .trim()
    .slice(0, 5);
  const endTime = String(formData.get("end_time") ?? "")
    .trim()
    .slice(0, 5);

  if (!title) return { ok: false, message: "Título obligatorio." };
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { ok: false, message: "Completá horario de inicio y fin." };
  }
  if (parseClockToMinutes(endTime) <= parseClockToMinutes(startTime)) {
    return {
      ok: false,
      message: "El horario de fin debe ser mayor al de inicio.",
    };
  }

  if (recurrence === "recurring") {
    const dayOfWeek = Number(formData.get("day_of_week"));
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, message: "Elegí un día de la semana." };
    }

    const { data: inserted, error } = await supabase
      .from(DB_TABLES.trainingBlocks)
      .insert({
        club_id: court.club_id,
        court_id: courtId,
        title,
        coach,
        modality,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return {
        ok: false,
        message: error?.message ?? "No se pudo crear el entrenamiento.",
      };
    }
    const trainingBlockId = String((inserted as { id: string }).id);

    // Un solo court_block por ocurrencia, en start_time — igual que fixed_slots
    // (generateMatchForSlotOnDate): no se genera un bloqueo por cada slot de 90
    // min que el entrenamiento pueda llegar a cubrir si dura más de 90 min.
    const todayYmd = getTodayYmdInArgentina();
    const nowClock = getCurrentClockInArgentina();
    const upcomingDates = getUpcomingDatesForDayOfWeek(
      dayOfWeek,
      getArgentinaNowAtNoon(),
      27,
    );
    let created = 0;
    for (const date of upcomingDates) {
      if (date === todayYmd && startTime <= nowClock) {
        console.log(
          `[createTrainingBlockAction] training=${trainingBlockId} omitido ${date}: el horario ${startTime} ya pasó hoy (ahora ${nowClock})`,
        );
        continue;
      }
      const { error: blockErr } = await supabase
        .from(DB_TABLES.courtBlocks)
        .insert({
          court_id: courtId,
          date,
          start_time: startTime,
          blocked_date: date,
          blocked_time: startTime,
          reason: "entrenamiento_externo",
          created_by: ctx.userId,
        });
      if (blockErr) {
        console.error(
          `[createTrainingBlockAction] training=${trainingBlockId} fecha=${date}: no se pudo bloquear — ${blockErr.message}`,
        );
      } else {
        created++;
        console.log(
          `[createTrainingBlockAction] training=${trainingBlockId} fecha=${date}: court_block creado OK`,
        );
      }
    }
    console.log(
      `[createTrainingBlockAction] training=${trainingBlockId}: ${created}/${upcomingDates.length} court_blocks creados`,
    );
  } else {
    const date = String(formData.get("date") ?? "").trim();
    if (!date) return { ok: false, message: "Elegí una fecha." };
    const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
      court_id: courtId,
      date,
      start_time: startTime,
      blocked_date: date,
      blocked_time: startTime,
      reason: "entrenamiento_externo",
      created_by: ctx.userId,
    });
    if (error) return { ok: false, message: error.message };
    console.log(
      `[createTrainingBlockAction] entrenamiento puntual creado: cancha=${courtId} fecha=${date} hora=${startTime}`,
    );
  }

  revalidatePath("/admin/clases");
  return { ok: true, message: "Entrenamiento registrado." };
}

export async function deactivateTrainingBlockAction(
  formData: FormData,
): Promise<void> {
  const trainingBlockId = String(
    formData.get("training_block_id") ?? "",
  ).trim();
  if (!trainingBlockId) redirect("/admin/clases");

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.trainingBlocks)
    .select("id,club_id,court_id,start_time")
    .eq("id", trainingBlockId)
    .maybeSingle();
  const training = row as {
    id: string;
    club_id: string;
    court_id: string;
    start_time: string;
  } | null;

  if (training && ctx.clubIds.includes(training.club_id)) {
    await supabase
      .from(DB_TABLES.trainingBlocks)
      .update({ is_active: false })
      .eq("id", trainingBlockId);

    // "Dar de baja" tiene que liberar la cancha ya — no alcanza con dejar de
    // generar bloqueos nuevos, hay que borrar los que ya se generaron a futuro.
    const todayYmd = getTodayYmdInArgentina();
    await supabase
      .from(DB_TABLES.courtBlocks)
      .delete()
      .eq("court_id", training.court_id)
      .eq("blocked_time", String(training.start_time).slice(0, 5))
      .eq("reason", "entrenamiento_externo")
      .gte("blocked_date", todayYmd);
  }

  revalidatePath("/admin/clases");
  redirect("/admin/clases");
}

// Libera una única fecha puntual de un training_block recurrente (ej. "el
// profesor no viene el 15/03") sin desactivar el turno para las semanas
// siguientes — solo borra el court_block de esa fecha exacta.
export async function liberarFechaPuntualAction(
  formData: FormData,
): Promise<void> {
  const trainingBlockId = String(
    formData.get("training_block_id") ?? "",
  ).trim();
  const fecha = String(formData.get("fecha") ?? "").trim();
  if (!trainingBlockId || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    redirect("/admin/clases");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.trainingBlocks)
    .select("id,club_id,court_id,day_of_week,start_time")
    .eq("id", trainingBlockId)
    .maybeSingle();
  const training = row as {
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
  } | null;

  if (training && ctx.clubIds.includes(training.club_id)) {
    const fechaDayOfWeek = new Date(`${fecha}T12:00:00`).getDay();
    if (fechaDayOfWeek === training.day_of_week) {
      await supabase
        .from(DB_TABLES.courtBlocks)
        .delete()
        .eq("court_id", training.court_id)
        .eq("blocked_date", fecha)
        .eq("blocked_time", String(training.start_time).slice(0, 5))
        .eq("reason", "entrenamiento_externo");
    }
  }

  revalidatePath("/admin/clases");
  redirect("/admin/clases");
}

export async function deleteExternalTrainingBlockRowAction(
  formData: FormData,
): Promise<void> {
  const courtBlockId = String(formData.get("court_block_id") ?? "").trim();
  if (!courtBlockId) redirect("/admin/clases");

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("id,court_id")
    .eq("id", courtBlockId)
    .maybeSingle();
  const block = row as { id: string; court_id: string } | null;

  if (block && ctx.courtIds.includes(block.court_id)) {
    await supabase.from(DB_TABLES.courtBlocks).delete().eq("id", courtBlockId);
  }

  revalidatePath("/admin/clases");
  redirect("/admin/clases");
}
