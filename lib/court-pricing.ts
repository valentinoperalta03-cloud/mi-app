import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { normalizeSlotTime } from "@/lib/court-slots";

/**
 * Fuente única del precio efectivo de un turno de cancha.
 *
 * Semántica (la misma que ya aplicaban reservarCancha / abrirPartido /
 * crear-partido / admin): el precio se resuelve por DÍA + START_TIME exacto
 * del turno, no por franja:
 *   1. court_schedules con day_of_week = día de la fecha y start_time = inicio
 *   2. court_schedules legacy con day_of_week IS NULL y start_time = inicio
 *   3. courts.price (precio base)
 *
 * Solo sirve para operaciones NUEVAS (mostrar un turno libre, crear o mover un
 * booking). Un match ya creado guarda su precio en matches.total_price y ese
 * snapshot es lo que leen Cobros / Finanzas: nunca se recalcula contra las
 * reglas actuales.
 */

export type CourtPriceRule = {
  courtId: string;
  /** 0 = domingo (convención de Date#getDay). null = regla legacy sin día. */
  dayOfWeek: number | null;
  /** HH:mm */
  startTime: string;
  price: number;
};

export type CourtPricing = {
  basePriceByCourt: Map<string, number | null>;
  rules: CourtPriceRule[];
};

/** Día de semana de una fecha YYYY-MM-DD. Mediodía local para evitar corrimientos de zona horaria. */
export function dayOfWeekForDate(dateYmd: string): number {
  return new Date(`${dateYmd}T12:00:00`).getDay();
}

/** Resolución en memoria para una fecha concreta. `null` solo si no hay regla y la cancha no tiene precio base. */
export function resolvePriceFromPricing(
  pricing: CourtPricing,
  courtId: string,
  dateYmd: string,
  startTime: string
): number | null {
  return resolvePriceForDayOfWeek(pricing, courtId, dayOfWeekForDate(dateYmd), startTime);
}

/** Misma resolución por día de semana (editor de precios del admin, que no trabaja con fechas). */
export function resolvePriceForDayOfWeek(
  pricing: CourtPricing,
  courtId: string,
  day: number,
  startTime: string
): number | null {
  const time = normalizeSlotTime(startTime);
  const rulesForSlot = pricing.rules.filter((r) => r.courtId === courtId && r.startTime === time);
  const specific = rulesForSlot.find((r) => r.dayOfWeek === day);
  if (specific) return specific.price;
  const legacy = rulesForSlot.find((r) => r.dayOfWeek === null);
  if (legacy) return legacy.price;
  return pricing.basePriceByCourt.get(courtId) ?? null;
}

/** Carga batch: 2 queries para cualquier cantidad de canchas y turnos. */
export async function loadCourtPricing(supabase: SupabaseClient, courtIds: string[]): Promise<CourtPricing> {
  const ids = Array.from(new Set(courtIds.filter(Boolean)));
  if (ids.length === 0) return { basePriceByCourt: new Map(), rules: [] };

  const [{ data: courtRows }, { data: ruleRows }] = await Promise.all([
    supabase.from(DB_TABLES.courts).select("id,price").in("id", ids),
    supabase
      .from(DB_TABLES.courtSchedules)
      .select("court_id,day_of_week,start_time,price_override")
      .in("court_id", ids)
      .not("start_time", "is", null)
      .not("price_override", "is", null),
  ]);

  const basePriceByCourt = new Map<string, number | null>();
  for (const row of (courtRows ?? []) as Array<{ id: string; price: number | string | null }>) {
    basePriceByCourt.set(row.id, row.price == null ? null : Number(row.price));
  }

  const rules: CourtPriceRule[] = [];
  for (const row of (ruleRows ?? []) as Array<{
    court_id: string;
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | string | null;
  }>) {
    const startTime = normalizeSlotTime(row.start_time);
    const price = Number(row.price_override);
    if (!startTime || row.price_override == null || !Number.isFinite(price)) continue;
    rules.push({
      courtId: row.court_id,
      dayOfWeek: row.day_of_week == null ? null : Number(row.day_of_week),
      startTime,
      price,
    });
  }

  return { basePriceByCourt, rules };
}

/**
 * Precio efectivo server-side de UN turno. Es la autoridad para crear o mover un
 * booking: nunca se usa un precio enviado por el cliente. Sin regla ni precio
 * base devuelve 0 (mismo fallback que tenían las acciones).
 */
export async function resolveCourtSlotPrice(params: {
  supabase: SupabaseClient;
  courtId: string;
  date: string;
  startTime: string;
}): Promise<number> {
  const pricing = await loadCourtPricing(params.supabase, [params.courtId]);
  return resolvePriceFromPricing(pricing, params.courtId, params.date, params.startTime) ?? 0;
}

/** Rango de precios posibles de una cancha (reglas + base), para displays de referencia. */
export function courtPriceRange(pricing: CourtPricing, courtId: string): { min: number; max: number } | null {
  const values = pricing.rules.filter((r) => r.courtId === courtId).map((r) => r.price);
  const base = pricing.basePriceByCourt.get(courtId);
  if (base != null && Number.isFinite(base)) values.push(base);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function formatCourtPriceRange(range: { min: number; max: number } | null): string | null {
  if (!range) return null;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  return range.min === range.max ? fmt(range.min) : `${fmt(range.min)} – ${fmt(range.max)}`;
}
