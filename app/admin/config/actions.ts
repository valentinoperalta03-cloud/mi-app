"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

function normalizeClockInput(raw: string, fallback: string) {
  const s = String(raw ?? "").trim();
  if (s.length >= 5 && /^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  return fallback;
}

export async function saveClubHours(formData: FormData) {
  const open = normalizeClockInput(String(formData.get("open_time") ?? ""), "09:00");
  const close = normalizeClockInput(String(formData.get("close_time") ?? ""), "22:30");

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
    redirect(`/admin/config?error=${enc(clubErr.message)}`);
  }

  const { data: courts } = await supabase.from(DB_TABLES.courts).select("id").eq("club_id", clubId);
  const courtIds = ((courts ?? []) as Array<{ id: string }>).map((c) => c.id);
  for (const courtId of courtIds) {
    const { error: schErr } = await supabase
      .from(DB_TABLES.courtSchedules)
      .update({ open_time: open, close_time: close })
      .eq("court_id", courtId)
      .not("day_of_week", "is", null);
    if (schErr) {
      redirect(`/admin/config?error=${enc(schErr.message)}`);
    }
  }

  revalidatePath("/admin/config");
  revalidatePath("/admin/canchas");
  revalidatePath("/admin/reservas");
  redirect("/admin/config?hours_saved=1");
}

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function savePaymentMethods(formData: FormData) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config?payments_error=no_club");

  const clubId = ctx.clubIds[0];
  const payload = {
    accepts_cash: formData.get("accepts_cash") === "on",
    accepts_transfer: formData.get("accepts_transfer") === "on",
    bank_alias: getField(formData, "bank_alias") || null,
    bank_cbu: getField(formData, "bank_cbu") || null,
  };

  const { error } = await supabase.from(DB_TABLES.clubs).update(payload).eq("id", clubId).eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config?payments_error=${enc(error.message)}`);
  }

  revalidatePath("/admin/config");
  redirect("/admin/config?payments_saved=1");
}

export async function saveCancellationPolicy(formData: FormData) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config?policy_error=no_club");

  const clubId = ctx.clubIds[0];
  const policy = getField(formData, "cancellation_policy");
  const hoursRaw = getField(formData, "cancellation_hours");
  const hours = hoursRaw === "" ? null : Number(hoursRaw);

  const payload: { cancellation_policy: string | null; cancellation_hours?: number | null } = {
    cancellation_policy: policy || null,
    cancellation_hours: Number.isFinite(hours) ? hours : null,
  };

  const { error } = await supabase.from(DB_TABLES.clubs).update(payload).eq("id", clubId).eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config?policy_error=${enc(error.message)}`);
  }

  revalidatePath("/admin/config");
  redirect("/admin/config?policy_saved=1");
}

export async function updateFinancePin(formData: FormData) {
  const currentPin = String(formData.get("current_pin") ?? "").trim();
  const newPin = String(formData.get("new_pin") ?? "").trim();
  const confirmPin = String(formData.get("confirm_pin") ?? "").trim();

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config?pin_error=no_club");

  if (!/^\d{4,6}$/.test(newPin)) {
    redirect(`/admin/config?pin_error=${enc("El nuevo PIN debe tener entre 4 y 6 dígitos.")}`);
  }
  if (newPin !== confirmPin) {
    redirect(`/admin/config?pin_error=${enc("La confirmación del PIN no coincide.")}`);
  }

  const clubId = ctx.clubIds[0];
  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("finance_pin")
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  const storedPin = String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim();

  if (storedPin) {
    if (!currentPin) {
      redirect(`/admin/config?pin_error=${enc("Ingresá el PIN actual.")}`);
    }
    if (currentPin !== storedPin) {
      redirect(`/admin/config?pin_error=${enc("El PIN actual es incorrecto.")}`);
    }
  }

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ finance_pin: newPin })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config?pin_error=${enc(error.message)}`);
  }

  redirect("/admin/config?pin_saved=1");
}
