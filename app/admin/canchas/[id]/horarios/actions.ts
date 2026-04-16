"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const ERROR_MSG = "No se pudieron guardar los horarios";

function redirectWithError(courtId: string) {
  redirect(`/admin/canchas/${courtId}/horarios?error=${encodeURIComponent(ERROR_MSG)}`);
}

export async function saveSchedules(formData: FormData): Promise<never> {
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
    redirectWithError(courtId);
  }

  for (let d = 0; d <= 6; d++) {
    const active = formData.get(`day_${d}_active`) === "on";
    const open = getField(formData, `day_${d}_open`) || "08:00";
    const close = getField(formData, `day_${d}_close`) || "22:00";

    const { error: delErr } = await supabase
      .from(DB_TABLES.courtSchedules)
      .delete()
      .eq("court_id", courtId)
      .eq("day_of_week", d);
    if (delErr) {
      redirectWithError(courtId);
    }

    if (active) {
      const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert({
        court_id: courtId,
        day_of_week: d,
        open_time: open.length >= 5 ? open.slice(0, 5) : open,
        close_time: close.length >= 5 ? close.slice(0, 5) : close,
      });
      if (insErr) {
        redirectWithError(courtId);
      }
    }
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}
