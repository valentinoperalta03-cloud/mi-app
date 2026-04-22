"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export type ManualBlockState = { success: boolean; message: string };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function adminCancelReservation(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  if (!matchId) {
    redirect("/admin/reservas");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }

  const { data: row, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("court_id,match_type,owner_id")
    .eq("id", matchId)
    .maybeSingle();

  if (fetchErr || !row) {
    redirect("/admin/reservas");
  }

  const typed = row as { court_id: string; match_type: string | null; owner_id: string | null };
  if (!ctx.courtIds.includes(typed.court_id) || typed.match_type !== "reservation") {
    redirect("/admin/reservas");
  }

  const { error } = await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", matchId);

  if (error) {
    redirect("/admin/reservas");
  }

  if (typed.owner_id) {
    const tpl = NOTIFICATION_TEMPLATES.reservation_cancelled("la cancha");
    await createNotification(supabase, {
      user_id: typed.owner_id,
      type: "reservation_cancelled",
      title: tpl.title,
      body: "Tu reserva fue cancelada por la administración del club.",
      match_id: matchId,
    });
  }

  revalidatePath("/admin/reservas");
  redirect("/admin/reservas");
}

export async function createManualCourtBlockAction(
  _prev: ManualBlockState,
  formData: FormData
): Promise<ManualBlockState> {
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const startTime = getField(formData, "start_time");

  if (!courtId || !date || !startTime) {
    return { success: false, message: "Completa cancha, fecha y hora." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { success: false, message: "Sesion invalida." };
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { success: false, message: "La cancha no pertenece a tu club." };
  }

  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: startTime.length >= 5 ? startTime.slice(0, 5) : startTime,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/club/gestion");
  return { success: true, message: "Bloqueo creado." };
}
