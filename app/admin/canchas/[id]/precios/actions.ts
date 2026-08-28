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
  redirect(
    `/admin/canchas/${courtId}/horarios?price_error=${encodeURIComponent(message)}`,
  );
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

  const durationMin = Math.max(
    30,
    Number(getField(formData, "slot_duration_minutes")) || 90,
  );

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
    // upsert (no insert): un doble submit del form puede solapar el DELETE
    // de una request con el INSERT de la otra y disparar "duplicate key" en
    // el índice único court_schedules_court_id_day_of_week_start_time_key
    // (court_id, day_of_week, start_time) — con upsert la segunda request
    // actualiza en vez de chocar.
    const { error: insErr } = await supabase
      .from(DB_TABLES.courtSchedules)
      .upsert(rows as never, { onConflict: "court_id,day_of_week,start_time" });
    if (insErr) redirectPreciosError(courtId, insErr.message);
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/horarios?price_saved=1`);
}

export type BulkPriceInput = {
  courtIds: string[];
  days: number[];
  fromTime: string;
  toTime: string;
  price: number;
};

export type BulkPriceState = { ok: boolean; error?: string; updated?: number };

/** Genera los inicios de turno de 90 en 90 min entre from (inclusive) y to (exclusive). */
function slotsInRange(from: string, to: string): string[] {
  const slots: string[] = [];
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let cur = fh * 60 + fm;
  const end = th * 60 + tm;
  while (cur < end) {
    const h = (Math.floor(cur / 60) % 24).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    cur += 90;
  }
  return slots;
}

/** Aplica un mismo precio a varias canchas/días/franja de una sola vez (mismo destino que saveCourtHourlyPrices: court_schedules). */
export async function applyBulkPricesAction(input: BulkPriceInput): Promise<BulkPriceState> {
  const { courtIds, days, fromTime, toTime, price } = input;

  if (!courtIds.length) return { ok: false, error: "Seleccioná al menos una cancha." };
  if (!days.length) return { ok: false, error: "Seleccioná al menos un día." };
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Día inválido." };
  }
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Precio inválido." };
  const slots = slotsInRange(fromTime, toTime);
  if (slots.length === 0) return { ok: false, error: "Franja horaria inválida." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  if (!courtIds.every((id) => ctx.courtIds.includes(id))) {
    return { ok: false, error: "Alguna cancha no está autorizada." };
  }

  const rows = courtIds.flatMap((courtId) =>
    days.flatMap((day) =>
      slots.map((slot) => ({
        court_id: courtId,
        day_of_week: day,
        start_time: slot,
        end_time: minutesToClock(Math.min(parseClockToMinutes(slot) + 90, 24 * 60)),
        price_override: price,
        range_name: null,
        open_time: null,
        close_time: null,
      }))
    )
  );

  const { error } = await supabase
    .from(DB_TABLES.courtSchedules)
    .upsert(rows as never, { onConflict: "court_id,day_of_week,start_time" });
  if (error) return { ok: false, error: error.message };

  for (const courtId of courtIds) {
    revalidatePath(`/admin/canchas/${courtId}/horarios`);
  }
  revalidatePath("/admin/canchas");

  return { ok: true, updated: rows.length };
}

export type ApplyPricesState = { ok: boolean; message?: string };

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function applyCourtPricesToAllDays(
  courtId: string,
  dayOfWeek: number,
): Promise<ApplyPricesState> {
  if (
    !courtId ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    return { ok: false, message: "Datos inválidos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (!ctx.courtIds.includes(courtId))
    return { ok: false, message: "Cancha no autorizada." };

  const { data: sourceRaw, error: sourceErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,end_time,price_override")
    .eq("court_id", courtId)
    .eq("day_of_week", dayOfWeek);
  if (sourceErr) return { ok: false, message: sourceErr.message };
  const source = (sourceRaw ?? []) as Array<{
    start_time: string;
    end_time: string;
    price_override: number;
  }>;
  if (source.length === 0)
    return { ok: false, message: "No hay precios guardados para ese día." };

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
    })),
  );
  const { error: insErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .upsert(rows, { onConflict: "court_id,day_of_week,start_time" });
  if (insErr) return { ok: false, message: insErr.message };

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  return { ok: true };
}
