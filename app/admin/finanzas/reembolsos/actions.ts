"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { refundReservationPayment } from "@/lib/payment-refund";
import { createClient, createServiceClient } from "@/utils/supabase/server";

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

  // Se lee con service role: RLS de matches solo expone la fila al cliente de
  // sesión cuando auth.uid() = matches.owner_id (el JUGADOR), así que con la
  // sesión del club el SELECT no encontraba la fila. La autorización NO se
  // relaja: sigue siendo el club autenticado quien decide, vía ctx.courtIds
  // (derivado de clubs.owner_id = auth.uid()) validado justo abajo.
  const service = createServiceClient();
  const { data: row } = await service
    .from(DB_TABLES.matches)
    .select("id,court_id")
    .eq("id", matchId)
    .maybeSingle();
  const typed = row as { id: string; court_id: string } | null;
  if (!typed || !ctx.courtIds.includes(typed.court_id)) redirect(backTo);

  // payments también está scoped por RLS a auth.uid() = user_id (el
  // jugador) — se reutiliza el mismo service client de la lectura de arriba.
  const outcome = await refundReservationPayment(service, matchId);
  // "refunded_unsynced": MP ya reembolsó pero no se pudo persistir. No seguir
  // como éxito ni reintentar — mostrar el error y frenar acá.
  if (outcome.kind === "failed" || outcome.kind === "refunded_unsynced") {
    const sep = backTo.includes("?") ? "&" : "?";
    redirect(`${backTo}${sep}refund_error=${encodeURIComponent(outcome.message)}`);
  }

  revalidatePath("/admin/finanzas/reembolsos");
  revalidatePath("/admin/reservas");
  revalidatePath("/reservas");
  redirect(backTo);
}
