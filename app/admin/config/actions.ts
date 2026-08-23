"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

const VALID_OPEN = new Set([
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
]);

export async function saveClubHours(formData: FormData) {
  const open = String(formData.get("open_time") ?? "")
    .trim()
    .slice(0, 5);
  // El cierre siempre es medianoche: los turnos de 90 min se generan
  // automáticamente hasta el slot 22:30→00:00.
  const close = "00:00";

  if (!VALID_OPEN.has(open)) {
    redirect(
      `/admin/config/informacion?error=${enc("Horario de apertura no válido.")}`,
    );
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.length) {
    redirect("/login");
  }

  const clubId = ctx.clubIds[0];
  const hoursText = `${open} - ${close}`;

  const { error: clubErr } = await supabase
    .from(DB_TABLES.clubs)
    .update({
      open_time: open,
      close_time: close,
      business_hours: hoursText,
    })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

  if (clubErr) {
    redirect(`/admin/config/informacion?error=${enc(clubErr.message)}`);
  }

  // Eliminar horarios por día configurados en canchas individuales
  // para que todas hereden el horario del club
  const { data: courts } = await supabase
    .from(DB_TABLES.courts)
    .select("id")
    .eq("club_id", clubId);
  if (courts && courts.length > 0) {
    const ids = (courts as Array<{ id: string }>).map((c) => c.id);
    await supabase
      .from(DB_TABLES.courtSchedules)
      .delete()
      .in("court_id", ids)
      .not("day_of_week", "is", null);
    // Fijar slot_duration_minutes = 90 en todas las canchas
    await supabase
      .from(DB_TABLES.courts)
      .update({ slot_duration_minutes: 90 })
      .in("id", ids);
  }

  revalidatePath("/admin/config/informacion");
  revalidatePath("/admin/canchas");
  revalidatePath("/admin/reservas");
  redirect("/admin/config/informacion?hours_saved=1");
}

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function savePaymentMethods(formData: FormData) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length)
    redirect("/admin/config/pagos?payments_error=no_club");

  const clubId = ctx.clubIds[0];
  const payload = {
    accepts_cash: formData.get("accepts_cash") === "on",
    accepts_transfer: formData.get("accepts_transfer") === "on",
    bank_alias: getField(formData, "bank_alias") || null,
    bank_cbu: getField(formData, "bank_cbu") || null,
  };

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/pagos?payments_error=${enc(error.message)}`);
  }

  revalidatePath("/admin/config/pagos");
  redirect("/admin/config/pagos?payments_saved=1");
}

export async function saveCancellationPolicy(formData: FormData) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length)
    redirect("/admin/config/informacion?policy_error=no_club");

  const clubId = ctx.clubIds[0];
  const policy = getField(formData, "cancellation_policy");
  const hoursRaw = getField(formData, "cancellation_hours");
  const hours = hoursRaw === "" ? null : Number(hoursRaw);

  const payload: {
    cancellation_policy: string | null;
    cancellation_hours?: number | null;
  } = {
    cancellation_policy: policy || null,
    cancellation_hours: Number.isFinite(hours) ? hours : null,
  };

  // cancellation_hours no tiene GRANT UPDATE para authenticated (ver
  // 20260713130000_fix_clubs_billing_column_grants.sql) — el UPDATE con el
  // cliente normal falla entero por esa columna y ni cancellation_policy se
  // guarda. Se usa el service client, que bypassea esos grants por columna.
  const { error } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/informacion?policy_error=${enc(error.message)}`);
  }

  revalidatePath("/admin/config/informacion");
  redirect("/admin/config/informacion?policy_saved=1");
}
