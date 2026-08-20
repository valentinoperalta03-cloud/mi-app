"use server";

import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

export async function updateFinancePin(formData: FormData) {
  const currentPin = String(formData.get("current_pin") ?? "").trim();
  const newPin = String(formData.get("new_pin") ?? "").trim();
  const confirmPin = String(formData.get("confirm_pin") ?? "").trim();

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config/general?pin_error=no_club");

  if (!/^\d{4,6}$/.test(newPin)) {
    redirect(`/admin/config/general?pin_error=${enc("El nuevo PIN debe tener entre 4 y 6 dígitos.")}`);
  }
  if (newPin !== confirmPin) {
    redirect(`/admin/config/general?pin_error=${enc("La confirmación del PIN no coincide.")}`);
  }

  const clubId = ctx.clubIds[0];
  // finance_pin esta revocada para anon/authenticated: se lee/escribe con service client.
  // La pertenencia ya se validó arriba vía getOwnerAdminContext(supabase).
  const service = createServiceClient();
  const { data: clubRow } = await service
    .from(DB_TABLES.clubs)
    .select("finance_pin")
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  const storedPin = String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim();

  if (storedPin) {
    if (!currentPin) {
      redirect(`/admin/config/general?pin_error=${enc("Ingresá el PIN actual.")}`);
    }
    if (currentPin !== storedPin) {
      redirect(`/admin/config/general?pin_error=${enc("El PIN actual es incorrecto.")}`);
    }
  }

  const { error } = await service
    .from(DB_TABLES.clubs)
    .update({ finance_pin: newPin })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/general?pin_error=${enc(error.message)}`);
  }

  redirect("/admin/config/general?pin_saved=1");
}
