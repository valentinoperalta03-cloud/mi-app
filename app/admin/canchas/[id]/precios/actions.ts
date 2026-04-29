"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

function normalizeHour(value: string) {
  const v = value.trim();
  return v.length >= 5 ? v.slice(0, 5) : v;
}

export async function updateCourtHourlyPrice(courtId: string, hour: string, price: number) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { ok: false, message: "Sesion invalida." };
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { ok: false, message: "Cancha no autorizada." };
  }
  const hourNorm = normalizeHour(hour);
  if (!hourNorm) {
    return { ok: false, message: "Hora inválida." };
  }

  const payload = {
    court_id: courtId,
    start_time: hourNorm,
    price_override: price,
    day_of_week: null,
    open_time: null,
    close_time: null,
  };
  const upsert = await supabase.from(DB_TABLES.courtSchedules).upsert(payload as never, {
    onConflict: "court_id,start_time",
  });
  if (upsert.error) {
    return { ok: false, message: upsert.error.message };
  }
  return { ok: true, message: "Precio actualizado." };
}

export async function saveCourtHourlyPrices(formData: FormData): Promise<void> {
  const courtId = String(formData.get("court_id") ?? "").trim();
  if (!courtId) {
    redirect("/admin/canchas");
  }

  for (let h = 8; h <= 22; h++) {
    const hour = `${String(h).padStart(2, "0")}:00`;
    const raw = String(formData.get(`price_${hour}`) ?? "").trim();
    if (!raw) continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) continue;
    await updateCourtHourlyPrice(courtId, hour, price);
  }

  revalidatePath(`/admin/canchas/${courtId}/precios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/precios`);
}
