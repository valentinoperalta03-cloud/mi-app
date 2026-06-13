"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectHorariosError(courtId: string, message: string): never {
  redirect(`/admin/canchas/${courtId}/horarios?error=${encodeURIComponent(message)}`);
}

export async function saveSchedules(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  if (!courtId) {
    redirect("/admin/canchas?error=missing_court");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.courtIds.includes(courtId)) {
    redirectHorariosError(courtId, "No tenés permiso para editar esta cancha.");
  }

  const durationRaw = Number.parseInt(getField(formData, "slot_duration_minutes"), 10);
  const slotDurationMinutes = [60, 90, 120].includes(durationRaw) ? durationRaw : 90;
  await supabase
    .from(DB_TABLES.courts)
    .update({ slot_duration_minutes: slotDurationMinutes })
    .eq("id", courtId);

  for (let d = 0; d <= 6; d++) {
    const active = formData.get(`day_${d}_active`) === "on";
    const open = getField(formData, `day_${d}_open`) || "09:00";
    const close = getField(formData, `day_${d}_close`) || "23:59";

    const { error: delErr } = await supabase
      .from(DB_TABLES.courtSchedules)
      .delete()
      .eq("court_id", courtId)
      .eq("day_of_week", d);
    if (delErr) {
      redirectHorariosError(courtId, delErr.message);
    }

    if (active) {
      const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert({
        court_id: courtId,
        day_of_week: d,
        open_time: open.length >= 5 ? open.slice(0, 5) : open,
        close_time: close.length >= 5 ? close.slice(0, 5) : close,
      });
      if (insErr) {
        redirectHorariosError(courtId, insErr.message);
      }
    }
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  redirect(`/admin/canchas/${courtId}/horarios?saved=1`);
}
