import { DB_TABLES } from "./db-tables";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hold de pago para reservas de cancha (match_type: 'reservation'): mientras
 * el jugador está en el checkout de Mercado Pago, la cancha queda retenida
 * por HOLD_MINUTES. Si no paga en ese lapso, el hold se cancela y la cancha
 * vuelve a estar libre. El vencimiento vive en `matches.hold_expires_at`
 * (no se deriva de created_at) para tener una única fuente de verdad.
 */
export const HOLD_MINUTES = 10;

export function computeHoldExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
}

type HoldLike = {
  hold_expires_at?: string | null;
  created_at?: string | null;
};

/**
 * Un hold está vencido si `hold_expires_at` ya pasó. Para filas legacy sin
 * `hold_expires_at` (creadas antes de esta migración) se usa el mismo criterio
 * que tenía el cron: HOLD_MINUTES desde `created_at`.
 */
export function isHoldExpired(row: HoldLike, nowMs: number = Date.now()): boolean {
  if (row.hold_expires_at) {
    const expiresMs = new Date(row.hold_expires_at).getTime();
    return Number.isFinite(expiresMs) && expiresMs <= nowMs;
  }
  if (row.created_at) {
    const createdMs = new Date(row.created_at).getTime();
    return Number.isFinite(createdMs) && nowMs - createdMs >= HOLD_MINUTES * 60_000;
  }
  return false;
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

/** Violación del índice único "un solo hold pendiente por usuario". */
export function isPendingHoldConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code ?? "") : "";
  if (code !== "23505") return false;
  const msg = String("message" in error ? (error as { message?: string }).message ?? "" : "").toLowerCase();
  const details = String("details" in error ? (error as { details?: string }).details ?? "" : "").toLowerCase();
  return (
    msg.includes("one_pending_reservation_hold_per_owner") ||
    details.includes("one_pending_reservation_hold_per_owner")
  );
}

export const PENDING_HOLD_ERROR_MESSAGE =
  "Ya tenés una reserva pendiente de pago. Completá el pago o esperá a que venza para reservar otra cancha.";

type MatchRow = {
  id: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  hold_expires_at: string | null;
  created_at: string | null;
};

function clockToMinutes(clock: string): number {
  const [h, m] = clock.trim().slice(0, 5).split(":").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Cancela (match_status: 'cancelled', payment_status: 'expired') los holds de
 * pago vencidos que se solapan con el slot que se está por reservar. Necesario
 * ANTES del INSERT: el EXCLUDE constraint `sin_partidos_superpuestos` bloquea
 * el INSERT mientras la fila vencida siga con match_status != 'cancelled',
 * sin importar que la disponibilidad ya la ignore visualmente.
 */
export async function expireStaleHoldsForCourtSlot(
  supabase: SupabaseClient,
  courtId: string,
  scheduledDate: string,
  startMinutes: number,
  durationMinutes: number
): Promise<void> {
  const { data: rows } = await supabase
    .from(DB_TABLES.matches)
    .select("id,scheduled_time,duration_minutes,hold_expires_at,created_at")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .eq("match_status", "scheduled")
    .eq("payment_status", "pending");

  const now = Date.now();
  const staleIds = ((rows ?? []) as MatchRow[])
    .filter((row) => {
      const otherStart = clockToMinutes(String(row.scheduled_time ?? ""));
      const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 90;
      return slotsOverlap(startMinutes, durationMinutes, otherStart, otherDur) && isHoldExpired(row, now);
    })
    .map((row) => row.id);

  if (staleIds.length === 0) return;

  await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled", payment_status: "expired" })
    .in("id", staleIds)
    .eq("match_status", "scheduled")
    .eq("payment_status", "pending");
  await supabase
    .from(DB_TABLES.payments)
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("match_id", staleIds)
    .eq("status", "pending");
}

/**
 * Cancela los holds de pago vencidos del propio usuario (cualquier cancha),
 * para que un hold ya vencido no dispare falsamente "ya tenés una reserva
 * pendiente de pago" ni choque con el índice único de un solo hold por usuario.
 */
export async function expireStaleHoldsForOwner(supabase: SupabaseClient, ownerId: string): Promise<void> {
  const { data: rows } = await supabase
    .from(DB_TABLES.matches)
    .select("id,hold_expires_at,created_at")
    .eq("owner_id", ownerId)
    .eq("match_type", "reservation")
    .eq("match_status", "scheduled")
    .eq("payment_status", "pending");

  const now = Date.now();
  const staleIds = ((rows ?? []) as MatchRow[]).filter((row) => isHoldExpired(row, now)).map((row) => row.id);
  if (staleIds.length === 0) return;

  await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled", payment_status: "expired" })
    .in("id", staleIds)
    .eq("match_status", "scheduled")
    .eq("payment_status", "pending");
  await supabase
    .from(DB_TABLES.payments)
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("match_id", staleIds)
    .eq("status", "pending");
}

/** Hold de pago activo (no vencido) del usuario, si existe. Llamar después de expireStaleHoldsForOwner. */
export async function findActivePendingHold(
  supabase: SupabaseClient,
  ownerId: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("owner_id", ownerId)
    .eq("match_type", "reservation")
    .eq("match_status", "scheduled")
    .eq("payment_status", "pending")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}
