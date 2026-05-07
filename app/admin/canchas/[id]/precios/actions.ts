"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

const COURT_TURNS = [
  { start: "09:00", end: "10:30" },
  { start: "10:30", end: "12:00" },
  { start: "12:00", end: "13:30" },
  { start: "13:30", end: "15:00" },
  { start: "15:00", end: "16:30" },
  { start: "16:30", end: "18:00" },
  { start: "18:00", end: "19:30" },
  { start: "19:30", end: "21:00" },
  { start: "21:00", end: "22:30" },
  { start: "22:30", end: "23:59" },
] as const;

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeHour(value: string) {
  const v = value.trim();
  return v.length >= 5 ? v.slice(0, 5) : v;
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

  for (const turn of COURT_TURNS) {
    const raw = getField(formData, `price_${turn.start}`);
    if (!raw) continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      redirectPreciosError(courtId, `Precio inválido en ${turn.start}.`);
    }
    rows.push({
      court_id: courtId,
      day_of_week: null,
      start_time: normalizeHour(turn.start),
      end_time: normalizeHour(turn.end),
      price_override: price,
      range_name: null,
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
