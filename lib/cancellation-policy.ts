import { CANCELLATION_POLICY_PRESETS } from "@/lib/admin/cancellation-policy-presets";

/**
 * Fuente única de la política de cancelación: la ventana numérica del club
 * (`clubs.cancellation_hours`), la regla que aplica el backend al cancelar y el
 * copy que se le muestra al jugador. Todo lo que muestre la política al usuario
 * debe salir de acá para que nunca diga algo distinto de lo que hace el código.
 */

/** Usado cuando el club todavía no configuró `cancellation_hours`. Coincide con el default de los presets. */
export const DEFAULT_CANCELLATION_HOURS = 24;

const VALID_HOURS = new Set(CANCELLATION_POLICY_PRESETS.map((p) => p.hours));

/**
 * Normaliza el valor guardado del club a una de las ventanas de preset. Nunca viene del cliente.
 * NULL / vacío / no numérico caen al default: `Number(null)` y `Number("")` valen 0, que es
 * un preset válido ("Sin reembolso"), así que hay que descartarlos antes de convertir.
 */
export function resolveCancellationHours(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined) return DEFAULT_CANCELLATION_HOURS;
  if (typeof raw === "string" && raw.trim() === "") return DEFAULT_CANCELLATION_HOURS;
  const n = Number(raw);
  if (Number.isFinite(n) && VALID_HOURS.has(n)) return n;
  return DEFAULT_CANCELLATION_HOURS;
}

/**
 * Regla real del backend. `hours = 0` ("Sin reembolso") significa que ninguna
 * anticipación da derecho a reembolso, así que toda cancelación es tardía.
 * El borde exacto (minutesUntil === hours * 60) cuenta como anticipación
 * suficiente.
 */
export function isLateCancellation(minutesUntil: number, hours: number): boolean {
  if (hours <= 0) return true;
  return minutesUntil < hours * 60;
}

/**
 * ¿Este booking alcanzó alguna vez la confirmación? La política sólo aplica a
 * bookings confirmados: abrir un checkout o crear un partido incompleto no
 * compromete la cancha.
 *
 * `confirmed_at` es la marca durable. Para las filas anteriores a esa columna se
 * deriva el HECHO (nunca la hora) del estado actual: una reserva 'reserved' o un
 * amistoso 'full' están confirmados por definición. Un booking histórico ya
 * cancelado que alguna vez estuvo confirmado no es recuperable y cuenta como no
 * confirmado: preferimos no cobrar de más antes que inventar el dato.
 */
export function isBookingConfirmed(match: {
  confirmed_at?: string | null;
  match_status?: string | null;
}): boolean {
  if (match.confirmed_at) return true;
  const status = String(match.match_status ?? "").trim().toLowerCase();
  return status === "reserved" || status === "full";
}

/** Campos financieros de `matches` que describen una cuenta única por booking. */
export type BookingFinancials = {
  amount_paid: number;
  amount_pending: number;
  financial_status: "unpaid" | "partially_paid" | "fully_paid";
};

function financialStatusFor(paid: number, total: number): BookingFinancials["financial_status"] {
  if (paid <= 0) return "unpaid";
  return paid >= total ? "fully_paid" : "partially_paid";
}

/**
 * Cancelación TARDÍA de un booking confirmado: queda a cobrar el total de la
 * cancha menos lo que ya se abonó. La obligación es del match, no de un jugador:
 * una sola cuenta, sin filas en `payments` ni reparto por participante.
 *
 * Devuelve `null` cuando no hay precio cargado: sin total no se puede derivar un
 * saldo, y pisar los campos con ceros borraría dinero real.
 */
export function lateCancellationFinancials(totalPrice: number, amountPaid: number): BookingFinancials | null {
  if (!(totalPrice > 0)) return null;
  const paid = Math.min(Math.max(Number(amountPaid) || 0, 0), totalPrice);
  const pending = Math.max(totalPrice - paid, 0);
  return { amount_paid: paid, amount_pending: pending, financial_status: financialStatusFor(paid, totalPrice) };
}

/**
 * Cancelación A TIEMPO: no nace ninguna obligación, así que el saldo pendiente
 * queda en cero. Lo ya cobrado NO se toca — cancelar no devuelve dinero.
 */
export function onTimeCancellationFinancials(totalPrice: number, amountPaid: number): BookingFinancials {
  const total = Math.max(Number(totalPrice) || 0, 0);
  const paid = Math.max(Number(amountPaid) || 0, 0);
  return { amount_paid: paid, amount_pending: 0, financial_status: financialStatusFor(paid, total) };
}

function horasLabel(hours: number): string {
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

/** Cuándo empieza a aplicar la política. Los dos caminos de confirmación del producto. */
export const CONFIRMATION_EXPLAINER =
  "El turno queda confirmado al abonar la seña o, en un partido abierto, cuando se completan los 4 jugadores.";

/**
 * Regla mostrada al jugador. Deriva de la misma ventana que usa
 * `isLateCancellation`, y arranca por la condición de confirmación: crear una
 * reserva sin pagar o entrar a un partido incompleto no activa nada.
 */
export function cancellationNoticeText(hours: number): string {
  const condicion =
    hours <= 0
      ? "las cancelaciones no tienen reembolso y deberás abonar el valor total de la cancha"
      : `si cancelás con menos de ${horasLabel(hours)} de anticipación deberás abonar el valor total de la cancha`;
  return `Una vez confirmado el turno, ${condicion}. Si ya abonaste una seña, se descuenta del saldo pendiente.`;
}

/** Aviso en el paso de pago de la seña: ese pago es lo que confirma el turno. */
export function depositNoticeText(hours: number): string {
  const condicion =
    hours <= 0
      ? "las cancelaciones no tienen reembolso y deberás abonar el valor total de la cancha"
      : `si cancelás con menos de ${horasLabel(hours)} de anticipación deberás abonar el valor total de la cancha`;
  return `Al pagar la seña el turno queda confirmado y se aplica la política del club: ${condicion}. La seña ya abonada se descuenta del saldo.`;
}

/** Aviso al unirse a un partido abierto: el 4to jugador es el que confirma la cancha. */
export function openMatchNoticeText(hours: number): string {
  const condicion =
    hours <= 0
      ? "las cancelaciones no tendrán reembolso y se deberá abonar el valor total de la cancha"
      : `cancelar con menos de ${horasLabel(hours)} de anticipación implica abonar el valor total de la cancha`;
  return `Cuando el partido complete los 4 jugadores la cancha queda confirmada y se aplica la política del club: ${condicion}.`;
}

export const CANCELLATION_NOTICE_TITLE = "POLÍTICA DE CANCELACIÓN";
