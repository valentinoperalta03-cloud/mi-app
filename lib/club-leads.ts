// Consultas comerciales de clubes ("Quiero que me contacten" en /para-clubes).
// Módulo puro: lo usan el formulario (validación en vivo) y la API (validación real).

export const CLUB_LEAD_PROBLEMS = [
  { value: "reservas", label: "Paso mucho tiempo respondiendo reservas." },
  { value: "torneos", label: "Quiero organizar mejor mis torneos." },
  { value: "finanzas", label: "Necesito ordenar cobros y finanzas." },
  { value: "entrenamientos", label: "Quiero gestionar entrenamientos y clases." },
  { value: "turnos_fijos", label: "Me cuesta organizar los turnos fijos." },
  { value: "ocupacion", label: "Quiero mejorar la ocupación de mis canchas." },
  { value: "gestion_integral", label: "Busco un sistema para gestionar todo mi club." },
  { value: "otro", label: "Otro motivo." },
] as const;

export type ClubLeadProblem = (typeof CLUB_LEAD_PROBLEMS)[number]["value"];

export const CLUB_LEAD_STATUSES = [
  { value: "new", label: "Nueva" },
  { value: "contacted", label: "Contactada" },
  { value: "converted", label: "Registró su club" },
  { value: "discarded", label: "Descartada" },
] as const;

export type ClubLeadStatus = (typeof CLUB_LEAD_STATUSES)[number]["value"];

export const CLUB_LEAD_SOURCE = "landing_clubes";

/** `dial` vacío = "otro país": el número se escribe completo con +. */
export const LEAD_COUNTRIES = [
  { iso: "AR", name: "Argentina", dial: "54" },
  { iso: "UY", name: "Uruguay", dial: "598" },
  { iso: "CL", name: "Chile", dial: "56" },
  { iso: "PY", name: "Paraguay", dial: "595" },
  { iso: "BO", name: "Bolivia", dial: "591" },
  { iso: "BR", name: "Brasil", dial: "55" },
  { iso: "PE", name: "Perú", dial: "51" },
  { iso: "CO", name: "Colombia", dial: "57" },
  { iso: "MX", name: "México", dial: "52" },
  { iso: "ES", name: "España", dial: "34" },
  { iso: "US", name: "Estados Unidos", dial: "1" },
  { iso: "OTHER", name: "Otro país", dial: "" },
] as const;

export const CLUB_NAME_MAX = 120;
export const PHONE_INPUT_MAX = 32;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function isClubLeadProblem(v: unknown): v is ClubLeadProblem {
  return CLUB_LEAD_PROBLEMS.some((p) => p.value === v);
}

export function isClubLeadStatus(v: unknown): v is ClubLeadStatus {
  return CLUB_LEAD_STATUSES.some((s) => s.value === v);
}

export function problemLabel(v: string): string {
  return CLUB_LEAD_PROBLEMS.find((p) => p.value === v)?.label ?? v;
}

export function normalizeClubName(raw: unknown): Result<string> {
  if (typeof raw !== "string") return { ok: false, error: "Escribí el nombre de tu club." };
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "Escribí el nombre de tu club." };
  if (name.length < 2) return { ok: false, error: "El nombre es demasiado corto." };
  if (name.length > CLUB_NAME_MAX) return { ok: false, error: `Usá hasta ${CLUB_NAME_MAX} caracteres.` };
  if (/https?:\/\/|www\.|<|>/i.test(name)) return { ok: false, error: "Escribí solo el nombre del club, sin links." };
  return { ok: true, value: name };
}

/**
 * Número nacional argentino a 10 dígitos (área + abonado), sin 0, sin 9 y sin 15.
 * WhatsApp en Argentina siempre es celular: el E.164 lleva el 9 (+54 9 ...).
 */
function normalizeArgentinaNational(n: string): string | null {
  let d = n.replace(/^0+/, "");
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.length === 12) {
    const areaLens = d.startsWith("11") ? [2] : [3, 4];
    const areaLen = areaLens.find((len) => d.slice(len, len + 2) === "15");
    if (areaLen !== undefined) d = d.slice(0, areaLen) + d.slice(areaLen + 2);
  }
  return /^[1-8]\d{9}$/.test(d) ? d : null;
}

/**
 * Normaliza a E.164 (+<país><número>). `dial` es el código elegido en el selector;
 * si el número empieza con + o 00 se toma como internacional completo y se ignora `dial`.
 * No verifica que el número exista ni que tenga WhatsApp.
 */
export function normalizeWhatsapp(dial: unknown, raw: unknown): Result<string> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Escribí tu número de WhatsApp." };
  const input = raw.trim();
  if (input.length > PHONE_INPUT_MAX) return { ok: false, error: "El número es demasiado largo." };
  if (!/^[+\d\s().-]+$/.test(input)) return { ok: false, error: "Usá solo números." };

  let digits = input.replace(/\D/g, "");
  const international = input.startsWith("+") || digits.startsWith("00");
  let full: string;

  if (international) {
    full = digits.replace(/^00/, "");
  } else {
    const dialStr = typeof dial === "string" ? dial : "";
    if (!dialStr) return { ok: false, error: "Escribí el número completo empezando con + y el código de país." };
    if (!LEAD_COUNTRIES.some((c) => c.dial === dialStr)) return { ok: false, error: "Elegí un código de país válido." };
    digits = digits.replace(/^0+/, "");
    if (digits.length < 6) return { ok: false, error: "El número está incompleto. Incluí el código de área." };
    full = dialStr + digits;
  }

  if (full.startsWith("54")) {
    const ar = normalizeArgentinaNational(full.slice(2));
    if (!ar) return { ok: false, error: "Revisá el número: código de área + número, ej. 11 2345 6789." };
    full = `549${ar}`;
  }

  if (!/^[1-9]\d{7,14}$/.test(full)) return { ok: false, error: "Revisá el número de WhatsApp." };
  return { ok: true, value: `+${full}` };
}

export function whatsappHref(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Solo presentación: agrupa los números argentinos (+54 9 11 2345 6789). */
export function formatWhatsapp(e164: string): string {
  const m = /^\+549(\d{10})$/.exec(e164);
  if (!m) return e164;
  const n = m[1];
  const area = n.startsWith("11") ? 2 : 3;
  const rest = n.slice(area);
  return `+54 9 ${n.slice(0, area)} ${rest.slice(0, rest.length - 4)} ${rest.slice(-4)}`;
}

export type ClubLeadInput = { clubName: string; whatsapp: string; problem: ClubLeadProblem };

export function validateClubLead(body: {
  clubName?: unknown;
  dial?: unknown;
  phone?: unknown;
  problem?: unknown;
}): { ok: true; value: ClubLeadInput } | { ok: false; errors: Partial<Record<"clubName" | "phone" | "problem", string>> } {
  const errors: Partial<Record<"clubName" | "phone" | "problem", string>> = {};
  const name = normalizeClubName(body.clubName);
  const phone = normalizeWhatsapp(body.dial, body.phone);
  if (!name.ok) errors.clubName = name.error;
  if (!phone.ok) errors.phone = phone.error;
  if (!isClubLeadProblem(body.problem)) errors.problem = "Elegí qué te gustaría mejorar.";
  if (!name.ok || !phone.ok || !isClubLeadProblem(body.problem)) return { ok: false, errors };
  return { ok: true, value: { clubName: name.value, whatsapp: phone.value, problem: body.problem } };
}
