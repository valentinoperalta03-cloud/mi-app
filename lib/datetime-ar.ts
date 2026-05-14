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

/**
 * Convierte fecha + hora de reloj en Argentina (wall clock) a milisegundos UTC.
 * Útil para comparar `scheduled_date` + `scheduled_time` con `Date.now()`.
 */
export function utcMsForArgentinaWallClock(dateYmd: string, hhmm: string): number {
  const [Y, M, D] = dateYmd.split("-").map((x) => Number.parseInt(x, 10));
  const t = hhmm.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D) || !Number.isFinite(h) || !Number.isFinite(m)) {
    return Number.NaN;
  }
  let guess = Date.UTC(Y, M - 1, D, h, m, 0);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (let i = 0; i < 12; i++) {
    const p = fmt.formatToParts(new Date(guess));
    const y = Number(p.find((x) => x.type === "year")?.value);
    const mo = Number(p.find((x) => x.type === "month")?.value);
    const d = Number(p.find((x) => x.type === "day")?.value);
    const hh = Number(p.find((x) => x.type === "hour")?.value);
    const mm = Number(p.find((x) => x.type === "minute")?.value);
    if (y === Y && mo === M && d === D && hh === h && mm === m) {
      return guess;
    }
    guess += ((h - hh) * 60 + (m - mm)) * 60_000;
  }
  return guess;
}

export { AR_TIME_ZONE };
