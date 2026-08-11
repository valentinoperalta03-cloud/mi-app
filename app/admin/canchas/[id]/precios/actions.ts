"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectPreciosError(courtId: string, message: string): never {
  redirect(`/admin/canchas/${courtId}/horarios?price_error=${encodeURIComponent(message)}`);
}

export async function saveCourtHourlyPrices(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  if (!courtId) redirect("/admin/canchas");

  const dayOfWeek = Number(getField(formData, "day_of_week"));
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    redirectPreciosError(courtId, "Día inválido.");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) {
    redirectPreciosError(courtId, "No tenés permiso para editar esta cancha.");
  }

  const durationMin = Math.max(30, Number(getField(formData, "slot_duration_minutes")) || 90);

  type SlotPriceRow = {
    court_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    price_override: number;
    range_name: null;
    open_time: null;
    close_time: null;
  };
  const rows: SlotPriceRow[] = [];

  // Lee dinámicamente todos los campos price_HH:MM del formulario
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price_")) continue;
    const startTime = key.slice("price_".length);
    if (!/^\d{2}:\d{2}$/.test(startTime)) continue;
    const raw = String(value).trim();
    if (!raw) continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      redirectPreciosError(courtId, `Precio inválido en ${startTime}.`);
    }
    const endMin = parseClockToMinutes(startTime) + durationMin;
    const endTime = minutesToClock(Math.min(endMin, 24 * 60));
    rows.push({
      court_id: courtId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      price_override: price,
      range_name: null,
      open_time: null,
      close_time: null,
    });
  }

  // Solo rama precios de court_schedules. Se borra/reinserta solo el día
  // seleccionado — las filas con day_of_week IS NULL (precio legacy, previo a
  // precios por día) no se tocan y siguen actuando como fallback para los
  // días que todavía no se guardaron explícitamente.
  const { error: delErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .delete()
    .eq("court_id", courtId)
    .eq("day_of_week", dayOfWeek);

  if (delErr) redirectPreciosError(courtId, delErr.message);

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert(rows as never);
    if (insErr) redirectPreciosError(courtId, insErr.message);
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/horarios?price_saved=1`);
}

export type ApplyPricesState = { ok: boolean; message?: string };

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function applyCourtPricesToAllDays(courtId: string, dayOfWeek: number): Promise<ApplyPricesState> {
  if (!courtId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, message: "Datos inválidos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (!ctx.courtIds.includes(courtId)) return { ok: false, message: "Cancha no autorizada." };

  const { data: sourceRaw, error: sourceErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,end_time,price_override")
    .eq("court_id", courtId)
    .eq("day_of_week", dayOfWeek);
  if (sourceErr) return { ok: false, message: sourceErr.message };
  const source = (sourceRaw ?? []) as Array<{ start_time: string; end_time: string; price_override: number }>;
  if (source.length === 0) return { ok: false, message: "No hay precios guardados para ese día." };

  const otherDays = ALL_DAYS.filter((d) => d !== dayOfWeek);

  const { error: delErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .delete()
    .eq("court_id", courtId)
    .in("day_of_week", otherDays);
  if (delErr) return { ok: false, message: delErr.message };

  const rows = otherDays.flatMap((day) =>
    source.map((r) => ({
      court_id: courtId,
      day_of_week: day,
      start_time: r.start_time,
      end_time: r.end_time,
      price_override: r.price_override,
      range_name: null,
      open_time: null,
      close_time: null,
    }))
  );
  const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert(rows);
  if (insErr) return { ok: false, message: insErr.message };

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  return { ok: true };
}
