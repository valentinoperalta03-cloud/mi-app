const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Fecha local de Argentina en formato YYYY-MM-DD.
 * Se usa para comparar con columnas DATE (`scheduled_date`) sin desfasajes UTC.
 */
export function getTodayYmdInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatLongDateInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

export function formatDateInArgentina(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(date);
}

export { AR_TIME_ZONE };
