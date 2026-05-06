"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const RANGE_KEYS = ["manana", "tarde", "noche"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function clockToMinutes(clock: string): number {
  const s = clock.slice(0, 5);
  const [h, m] = s.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function redirectPreciosError(courtId: string, message: string): never {
  redirect(`/admin/canchas/${courtId}/precios?error=${encodeURIComponent(message)}`);
}

export async function saveCourtHourlyPrices(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  if (!courtId) {
    redirect("/admin/canchas");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.courtIds.includes(courtId)) {
    redirectPreciosError(courtId, "No tenés permiso para editar esta cancha.");
  }

  type InsertRow = {
    court_id: string;
    day_of_week: null;
    start_time: string;
    end_time: string;
    price_override: number;
    range_name: string;
    open_time: null;
    close_time: null;
  };

  const rows: InsertRow[] = [];

  for (const key of RANGE_KEYS) {
    const on = formData.get(`${key}_on`) === "on";
    if (!on) continue;

    const start = getField(formData, `${key}_start`);
    const end = getField(formData, `${key}_end`);
    const priceRaw = getField(formData, `${key}_price`);
    if (!start || !end) {
      redirectPreciosError(courtId, "Completá hora de inicio y fin en cada rango activo.");
    }
    const startM = clockToMinutes(start.length >= 5 ? start.slice(0, 5) : start);
    const endM = clockToMinutes(end.length >= 5 ? end.slice(0, 5) : end);
    if (!Number.isFinite(startM) || !Number.isFinite(endM)) {
      redirectPreciosError(courtId, "Horario inválido.");
    }
    if (endM <= startM) {
      redirectPreciosError(courtId, "La hora de fin debe ser posterior a la de inicio en cada rango.");
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      redirectPreciosError(courtId, "Precio inválido.");
    }

    const startNorm = start.length >= 5 ? start.slice(0, 5) : start;
    const endNorm = end.length >= 5 ? end.slice(0, 5) : end;

    rows.push({
      court_id: courtId,
      day_of_week: null,
      start_time: startNorm,
      end_time: endNorm,
      price_override: price,
      range_name: key,
      open_time: null,
      close_time: null,
    });
  }

  const { error: delErr } = await supabase
    .from(DB_TABLES.courtSchedules)
    .delete()
    .eq("court_id", courtId)
    .is("day_of_week", null);

  if (delErr) {
    redirectPreciosError(courtId, delErr.message);
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert(rows as never);
    if (insErr) {
      redirectPreciosError(courtId, insErr.message);
    }
  }

  revalidatePath(`/admin/canchas/${courtId}/precios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/precios?saved=1`);
}
