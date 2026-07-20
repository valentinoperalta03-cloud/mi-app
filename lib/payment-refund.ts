import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { refundMercadoPagoPayment } from "@/lib/mercadopago";

export type PaymentRefundOutcome =
  | { kind: "refunded" }
  /** No hay nada que reembolsar por MP: pago offline (efectivo/transferencia), ya reembolsado o sin fila. */
  | { kind: "not_applicable" }
  | { kind: "failed" };

/**
 * Reembolsa una fila puntual de `payments` si tiene un pago de Mercado Pago
 * real pendiente de reembolsar (`status` approved o refund_requested —este
 * ultimo cubre el backlog del modelo viejo que solo prometia el reembolso—,
 * `payment_method` mercadopago y `mp_payment_id` presente). Es el mismo
 * `refundMercadoPagoPayment` que usa el jugador al cancelar su reserva.
 */
export async function refundApprovedPayment(
  admin: SupabaseClient,
  paymentId: string
): Promise<PaymentRefundOutcome> {
  const { data: row } = await admin
    .from(DB_TABLES.payments)
    .select("id, status, mp_payment_id, payment_method")
    .eq("id", paymentId)
    .maybeSingle();
  const p = row as {
    id: string;
    status: string | null;
    mp_payment_id: string | null;
    payment_method: string | null;
  } | null;
  if (!p) return { kind: "not_applicable" };
  if (p.status !== "approved" && p.status !== "refund_requested") return { kind: "not_applicable" };
  if (p.payment_method && p.payment_method !== "mercadopago") return { kind: "not_applicable" };
  const mpId = String(p.mp_payment_id ?? "").trim();
  if (!mpId) return { kind: "not_applicable" };

  const result = await refundMercadoPagoPayment(mpId);
  if (!result.ok) return { kind: "failed" };

  await admin
    .from(DB_TABLES.payments)
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  return { kind: "refunded" };
}

export type MatchRefundOutcome =
  | { kind: "refunded" }
  /** El match nunca tuvo un pago de MP aprobado (efectivo/transferencia/sin pagar) — cancelar sin prometer nada. */
  | { kind: "no_payment" }
  | { kind: "already_refunded" }
  | { kind: "failed"; message: string };

/**
 * Reembolso de una reserva (un solo pagador: `matches.owner_id`). Busca el
 * pago de MP del match y, si corresponde, ejecuta el reembolso real via
 * `refundApprovedPayment` y sincroniza los campos financieros del match.
 * Misma ruta de reembolso que usa el jugador — no duplica la llamada a MP.
 */
export async function refundReservationPayment(
  admin: SupabaseClient,
  matchId: string
): Promise<MatchRefundOutcome> {
  const { data: matchRow } = await admin
    .from(DB_TABLES.matches)
    .select("payment_status, financial_status, total_price")
    .eq("id", matchId)
    .maybeSingle();
  const m = matchRow as {
    payment_status: string | null;
    financial_status: string | null;
    total_price: number | null;
  } | null;
  if (!m) return { kind: "failed", message: "Reserva no encontrada." };

  const paymentStatus = String(m.payment_status ?? "").toLowerCase();
  const financialStatus = String(m.financial_status ?? "").toLowerCase();

  if (paymentStatus === "refunded") return { kind: "already_refunded" };

  // payment_status "paid" tambien lo usan los cobros offline confirmados (ver
  // app/admin/cobros/actions.ts), asi que esto solo habilita el intento — la
  // fila real de `payments` (mas abajo) es la que confirma si hubo MP de por medio.
  const mayHaveMpPayment =
    paymentStatus === "paid" ||
    paymentStatus === "refund_requested" ||
    financialStatus === "partially_paid" ||
    financialStatus === "fully_paid";
  if (!mayHaveMpPayment) return { kind: "no_payment" };

  const { data: paymentRow } = await admin
    .from(DB_TABLES.payments)
    .select("id, payment_method, mp_payment_id")
    .eq("match_id", matchId)
    .in("status", ["approved", "refund_requested"])
    .maybeSingle();
  const p = paymentRow as { id: string; payment_method: string | null; mp_payment_id: string | null } | null;

  if (!p || (p.payment_method && p.payment_method !== "mercadopago") || !String(p.mp_payment_id ?? "").trim()) {
    // No hay un pago de MP real que reembolsar (fue efectivo/transferencia, o no hay fila).
    return { kind: "no_payment" };
  }

  const outcome = await refundApprovedPayment(admin, p.id);
  if (outcome.kind !== "refunded") {
    return {
      kind: "failed",
      message: "No se pudo procesar el reembolso en Mercado Pago. Intentá de nuevo o procesalo manualmente.",
    };
  }

  const totalPrice = Number(m.total_price ?? 0);
  await admin
    .from(DB_TABLES.matches)
    .update({
      payment_status: "refunded",
      financial_status: "unpaid",
      amount_paid: 0,
      amount_pending: totalPrice,
    })
    .eq("id", matchId);

  return { kind: "refunded" };
}
