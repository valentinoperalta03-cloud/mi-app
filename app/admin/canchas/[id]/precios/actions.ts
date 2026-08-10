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

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) {
    redirectPreciosError(courtId, "No tenés permiso para editar esta cancha.");
  }

  const durationMin = Math.max(30, Number(getField(formData, "slot_duration_minutes")) || 90);

  type SlotPriceRow = {
    court_id: string;
    day_of_week: null;
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
      day_of_week: null,
      start_time: startTime,
      end_time: endTime,
      price_override: price,
      range_name: null,
      open_time: null,
      close_time: null,
    });
  }

  // Solo rama precios (day_of_week IS NULL) — los horarios ahora están en court_time_ranges.
  const { error: delErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .delete()
    .eq("court_id", courtId)
    .is("day_of_week", null);

  if (delErr) redirectPreciosError(courtId, delErr.message);

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert(rows as never);
    if (insErr) redirectPreciosError(courtId, insErr.message);
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/horarios?price_saved=1`);
}
