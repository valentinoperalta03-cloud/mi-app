import { log } from "@/lib/logger";
import { sendAlert } from "@/lib/alerts";
import { IllegalTransitionError } from "@/lib/state-machines/errors";

/** Filas `payments.status` + estados lógicos de flujo. */
export const PAYMENT_ROW_STATUSES = [
  "invited",
  "pending",
  "approved",
  "rejected",
  "refunded",
  "cancelled",
  "refund_requested",
  "expired",
] as const;
export type PaymentRowStatus = (typeof PAYMENT_ROW_STATUSES)[number];

const ALLOWED: Record<string, Set<string>> = {
  invited: new Set(["pending", "expired", "cancelled"]),
  pending: new Set(["approved", "rejected", "cancelled", "expired", "refund_requested"]),
  approved: new Set(["refunded", "refund_requested", "cancelled"]),
  rejected: new Set([]),
  refunded: new Set([]),
  cancelled: new Set([]),
  refund_requested: new Set(["refunded", "cancelled"]),
  expired: new Set(["pending", "invited"]),
};

function normalize(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export function canTransitionPaymentRow(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  const f = normalize(from) || "pending";
  const t = normalize(to);
  if (f === t) return true;
  return (ALLOWED[f] ?? new Set()).has(t);
}

export function assertPaymentRowTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  ctx?: { requestId?: string; paymentId?: string; userId?: string; trigger?: string }
): void {
  const f = normalize(from) || "pending";
  const t = normalize(to);
  if (f === t) return;
  if (canTransitionPaymentRow(f, t)) {
    log.info({
      event: "transition.payment_status",
      from: f,
      to: t,
      trigger: ctx?.trigger,
      requestId: ctx?.requestId,
      paymentId: ctx?.paymentId,
      userId: ctx?.userId,
    });
    return;
  }
  const err = new IllegalTransitionError("payment", f, t);
  log.error({
    event: "transition.payment_status.illegal",
    from: f,
    to: t,
    trigger: ctx?.trigger,
    requestId: ctx?.requestId,
    paymentId: ctx?.paymentId,
    userId: ctx?.userId,
    err,
  });
  void sendAlert({
    source: "app",
    kind: "state_machine",
    title: "Transición de pago no permitida",
    detail: `${f} → ${t} (payment ${ctx?.paymentId ?? "?"})`,
    requestId: ctx?.requestId,
  });
  throw err;
}

/** `matches.payment_status` (nivel partido / reserva). */
export const MATCH_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "expired",
  "rejected",
  "cancelled",
  "refunded",
  "cash_pending",
  "transfer_pending",
  "no_show",
  // Reserva confirmada sin seña (clubs.requires_deposit = false): el turno
  // completo queda pendiente de cobro EN el club, sin que el jugador haya
  // elegido un medio de pago. Deliberadamente distinto de "pending" (el
  // cron app/api/cron/expire-unpaid-matches/route.ts cancela automáticamente
  // cualquier match con payment_status='pending' a los 15 minutos — una
  // reserva sin seña ya está confirmada, no debe expirar nunca por eso) y
  // distinto de cash_pending/transfer_pending (esos sí representan un medio
  // de pago elegido por el jugador). Ver create_direct_reservation en
  // supabase/migrations/20260923100100_direct_reservation_rpc.sql.
  "club_pending",
] as const;

const MATCH_PAY_ALLOWED: Record<string, Set<string>> = {
  pending: new Set(["paid", "expired", "rejected", "cancelled", "refunded"]),
  paid: new Set(["expired", "rejected", "cancelled", "refunded"]),
  expired: new Set(["pending", "paid"]),
  rejected: new Set(["pending"]),
  cancelled: new Set([]),
  refunded: new Set([]),
  cash_pending: new Set(["paid", "no_show", "cancelled"]),
  transfer_pending: new Set(["paid", "no_show", "cancelled"]),
  no_show: new Set([]),
  // Mismas transiciones que cash_pending/transfer_pending: el club cobra
  // presencial (→ paid, vía admin/cobros) o la reserva se cancela sin que
  // haya nada que reembolsar (→ cancelled) o se marca ausencia (→ no_show).
  club_pending: new Set(["paid", "no_show", "cancelled"]),
};

export function assertMatchPaymentStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  ctx?: { requestId?: string; matchId?: string; trigger?: string }
): void {
  const f = normalize(from) || "pending";
  const t = normalize(to);
  if (f === t) return;
  if ((MATCH_PAY_ALLOWED[f] ?? new Set()).has(t)) {
    log.info({
      event: "transition.match_payment_status",
      from: f,
      to: t,
      trigger: ctx?.trigger,
      requestId: ctx?.requestId,
      matchId: ctx?.matchId,
    });
    return;
  }
  const err = new IllegalTransitionError("match_payment", f, t);
  log.error({
    event: "transition.match_payment_status.illegal",
    from: f,
    to: t,
    trigger: ctx?.trigger,
    requestId: ctx?.requestId,
    matchId: ctx?.matchId,
    err,
  });
  void sendAlert({
    source: "app",
    kind: "state_machine",
    title: "Transición payment_status (match) no permitida",
    detail: `${f} → ${t} (match ${ctx?.matchId ?? "?"})`,
    requestId: ctx?.requestId,
  });
  throw err;
}
