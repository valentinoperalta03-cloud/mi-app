"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Procesa un reembolso que quedó en `refund_requested` (modelo viejo que solo lo prometía). */
export async function processRefundRequestAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const month = getField(formData, "month");
  const backTo = `/admin/finanzas/reembolsos${month ? `?month=${encodeURIComponent(month)}` : ""}`;
  if (!matchId) redirect(backTo);

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: row } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as { id: string; court_id: string } | null;
  if (!typed || !ctx.courtIds.includes(typed.court_id)) redirect(backTo);

  const outcome = await refundReservationPayment(supabase, matchId);
  if (outcome.kind === "failed") {
    const sep = backTo.includes("?") ? "&" : "?";
    redirect(`${backTo}${sep}refund_error=${encodeURIComponent(outcome.message)}`);
  }

  revalidatePath("/admin/finanzas/reembolsos");
  revalidatePath("/admin/reservas");
  revalidatePath("/reservas");
  redirect(backTo);
}
