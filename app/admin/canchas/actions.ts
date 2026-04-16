"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCourt(formData: FormData) {
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");
  const clubId = getField(formData, "club_id");

  if (!name || !clubId) {
    return { error: "Completá nombre y club." };
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Precio inválido." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.clubIds.includes(clubId)) {
    return { error: "Club no autorizado." };
  }

  const { error } = await supabase.from(DB_TABLES.courts).insert({
    club_id: clubId,
    name,
    price,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/canchas");
  return { success: true };
}

export async function saveSchedules(formData: FormData) {
  const courtId = getField(formData, "court_id");
  if (!courtId) {
    return { error: "Cancha inválida." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { error: "Cancha no autorizada." };
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
      return { error: delErr.message };
    }

    if (active) {
      const { error: insErr } = await supabase.from(DB_TABLES.courtSchedules).insert({
        court_id: courtId,
        day_of_week: d,
        open_time: open.length >= 5 ? open.slice(0, 5) : open,
        close_time: close.length >= 5 ? close.slice(0, 5) : close,
      });
      if (insErr) {
        return { error: insErr.message };
      }
    }
  }

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  revalidatePath("/admin/canchas");
  return { success: true };
}
