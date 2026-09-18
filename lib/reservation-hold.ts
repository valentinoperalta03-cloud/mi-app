import { DB_TABLES } from "./db-tables";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hold de pago para reservas de cancha, vive en `reservation_holds` — NUNCA
 * en `matches`. Bajo la regla de producto vigente, una fila `matches` de
 * match_type='reservation' representa siempre una reserva ya confirmada
 * (seña pagada); no existe ningún estado intermedio dentro de matches.
 * Mientras el jugador está en el checkout de Mercado Pago, la cancha queda
 * retenida por HOLD_MINUTES en esta tabla separada. Si no paga en ese lapso,
 * el hold se expira y nunca llega a crear ningún match.
 */
export const HOLD_MINUTES = 10;

export function computeHoldExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
}

export function isHoldExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  const expiresMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresMs) && expiresMs <= nowMs;
}

export function slotsOverlap(
  aStartMinutes: number,
  aDurationMinutes: number,
  bStartMinutes: number,
  bDurationMinutes: number
): boolean {
  const aEnd = aStartMinutes + aDurationMinutes;
  const bEnd = bStartMinutes + bDurationMinutes;
  return aStartMinutes < bEnd && bStartMinutes < aEnd;
}

/** Violación del índice único "un solo hold pendiente por usuario" (reservation_holds). */
export function isPendingHoldConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  if (code !== "23505") return false;
  const msg = String("message" in error ? (error as { message?: string }).message ?? "" : "").toLowerCase();
  const details = String("details" in error ? (error as { details?: string }).details ?? "" : "").toLowerCase();
  return msg.includes("one_pending_hold_per_owner") || details.includes("one_pending_hold_per_owner");
}

/** Violación del EXCLUDE de solapamiento de horario entre holds pendientes. */
export function isHoldSlotConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  if (code !== "23P01") return false;
  const msg = String("message" in error ? (error as { message?: string }).message ?? "" : "").toLowerCase();
  return msg.includes("reservation_holds_no_overlap") || msg.includes("exclusion");
}

export const PENDING_HOLD_ERROR_MESSAGE =
  "Ya tenés una reserva pendiente de pago. Completá el pago o esperá a que venza para reservar otra cancha.";

type HoldRow = {
  id: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  expires_at: string;
};

function clockToMinutes(clock: string): number {
  const [h, m] = clock.trim().slice(0, 5).split(":").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Expira (status: 'expired') los holds de pago vencidos que se solapan con
 * el slot que se está por reservar — de cualquier usuario. Necesario ANTES
 * del INSERT: el EXCLUDE constraint reservation_holds_no_overlap bloquea el
 * INSERT mientras la fila vencida siga con status='pending', sin importar
 * que la disponibilidad ya la haya ignorado visualmente. Usa service client:
 * el hold vencido puede ser de OTRO usuario (RLS no lo permitiría).
 */
export async function expireStaleHoldsForCourtSlot(
  supabase: SupabaseClient,
  courtId: string,
  scheduledDate: string,
  startMinutes: number,
  durationMinutes: number
): Promise<void> {
  const { data: rows } = await supabase
    .from(DB_TABLES.reservationHolds)
    .select("id,scheduled_time,duration_minutes,expires_at")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .eq("status", "pending");

  const now = Date.now();
  const staleIds = ((rows ?? []) as HoldRow[])
    .filter((row) => {
      const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
      const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
      return slotsOverlap(startMinutes, durationMinutes, otherStart, otherDur) && isHoldExpired(row.expires_at, now);
    })
    .map((row) => row.id);

  if (staleIds.length === 0) return;

  await supabase
    .from(DB_TABLES.reservationHolds)
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("id", staleIds)
    .eq("status", "pending");
}

/**
 * Expira los holds vencidos del propio usuario (cualquier cancha), para que
 * uno ya vencido no dispare falsamente "ya tenés una reserva pendiente de
 * pago" ni choque con el índice único de un solo hold por usuario.
 */
export async function expireStaleHoldsForOwner(supabase: SupabaseClient, ownerId: string): Promise<void> {
  const { data: rows } = await supabase
    .from(DB_TABLES.reservationHolds)
    .select("id,expires_at")
    .eq("owner_id", ownerId)
    .eq("status", "pending");

  const now = Date.now();
  const staleIds = ((rows ?? []) as HoldRow[])
    .filter((row) => isHoldExpired(row.expires_at, now))
    .map((row) => row.id);
  if (staleIds.length === 0) return;

  await supabase
    .from(DB_TABLES.reservationHolds)
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("id", staleIds)
    .eq("status", "pending");
}

/**
 * Política de liberación de holds ante notificaciones de pago de Mercado Pago.
 *
 * Incidente 2026-09-18 (hold 6b3b672c-...): un webhook con status "cancelled"
 * de un PRIMER intento de pago canceló el hold ~67s después de creado. 25s
 * después llegó un SEGUNDO intento (mismo preference/external_reference,
 * mp_payment_id distinto) con status "approved" — pero el hold ya no estaba
 * pending, así que el dinero terminó en orphaned_reservation_payments y nunca
 * se creó la reserva. Checkout Pro permite reintentar con otro medio de pago
 * SIN abandonar la preferencia: cada intento genera un `payment` propio, y un
 * status rejected/cancelled/expired en UNO de ellos no es terminal para la
 * preferencia completa — todavía puede llegar un intento posterior aprobado.
 *
 * Por eso ningún status de un webhook individual puede cancelar el hold. El
 * hold solo termina por: (a) esta RPC consume_reservation_hold cuando llega
 * un pago approved, o (b) vencimiento natural de expires_at (lazy-expiry en
 * create_reservation_hold / cron expire-reservation-holds). El cliente/browser
 * ni un intento de pago individual son autoridad para liberar un hold que
 * puede tener dinero en vuelo.
 */
export function shouldReleaseHoldOnPaymentNotification(_mpStatus: string): boolean {
  return false;
}

/** Hold de pago activo (no vencido) del usuario, si existe. Llamar después de expireStaleHoldsForOwner. */
export async function findActivePendingHold(
  supabase: SupabaseClient,
  ownerId: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from(DB_TABLES.reservationHolds)
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}
