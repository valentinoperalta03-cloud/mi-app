import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";

// Normaliza un celular argentino a E.164 (+549 + área + abonado).
// Usa la metadata "mobile" de libphonenumber-js: solo acepta números que la
// numeración argentina reconoce como móviles. Quita +54, 0 de larga distancia,
// 9 móvil y 15 local sin duplicarlos. Devuelve null si no es un celular válido.
//
// Valida y normaliza el FORMATO. No prueba que el número exista ni que sea del
// jugador: nunca presentarlo como "verificado".

function validMobile(e164: string): string | null {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed && parsed.country === "AR" && parsed.isValid() ? parsed.number : null;
}

// "+54 54 9 ..." (el +54 fijo del campo más el que escribió el jugador) y
// "+54 9 9 ...". Ningún código de área argentino empieza con 5 ni con 9, así
// que colapsar esas repeticiones no puede alterar un número real.
function cleanInput(input: string): string {
  const raw = String(input ?? "").trim();
  const plus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (plus || digits.startsWith("54")) {
    while (digits.startsWith("5454")) digits = digits.slice(2);
    while (digits.startsWith("5499")) digits = `549${digits.slice(4)}`;
  }
  return plus || digits.startsWith("54") ? `+${digits}` : digits;
}

function normalizeLoose(input: string): string | null {
  const cleaned = cleanInput(input);
  if (cleaned.replace(/\D/g, "").length < 8) return null;

  const parsed = parsePhoneNumberFromString(cleaned, "AR");
  if (!parsed || (parsed.country && parsed.country !== "AR") || parsed.countryCallingCode !== "54") return null;
  if (parsed.isValid()) return parsed.number;

  // libphonenumber ya quitó +54 y el 0; lo que queda es el número nacional.
  const national = parsed.nationalNumber;

  // Formato de marcación local sin el 9 móvil (ej. 11 2233 4455): en E.164 los
  // celulares argentinos llevan el 9 entre el código de país y el de área.
  if (national.length === 10) return validMobile(`+549${national}`);

  // Área de 2 a 4 dígitos + 15 + abonado (ej. 2944 15 123456). Solo se acepta
  // si una única posición del 15 produce un celular válido.
  if (national.length === 12) {
    const candidates = new Set<string>();
    for (const areaLen of [2, 3, 4]) {
      if (national.slice(areaLen, areaLen + 2) !== "15") continue;
      const mobile = validMobile(`+549${national.slice(0, areaLen)}${national.slice(areaLen + 2)}`);
      if (mobile) candidates.add(mobile);
    }
    return candidates.size === 1 ? [...candidates][0] : null;
  }

  return null;
}

// Abonado con 7 dígitos finales iguales (11 1111-1111, 341 400-0000): no se
// asignan a líneas reales. Es el único criterio de "número ficticio".
function looksFake(e164: string): boolean {
  return /(\d)\1{6}$/.test(e164);
}

export function normalizeArMobile(input: string): string | null {
  const phone = normalizeLoose(input);
  return phone && !looksFake(phone) ? phone : null;
}

// Qué corregir cuando normalizeArMobile rechaza el número. null si es válido.
export function arMobileProblem(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw.replace(/\D/g, "")) return "Ingresá tu número de celular.";
  if (normalizeArMobile(raw)) return null;

  const cleaned = cleanInput(raw);
  if (cleaned.startsWith("+") && !cleaned.startsWith("+54")) {
    return "Por ahora solo aceptamos celulares de Argentina (+54).";
  }
  const loose = normalizeLoose(raw);
  if (loose && looksFake(loose)) return "Ese número no parece real. Ingresá tu celular.";

  let national = cleaned.replace(/\D/g, "");
  if (national.startsWith("54")) national = national.slice(2);
  if (national.startsWith("9")) national = national.slice(1);
  if (national.startsWith("0")) national = national.slice(1);

  if (national.startsWith("15")) return "Falta el código de área antes del 15 (ej. 11 15 2233 4455).";
  // Descuenta el 15 local para medir cuántos dígitos faltan o sobran.
  const local15 = [2, 3, 4].find((areaLen) => national.length > 10 && national.slice(areaLen, areaLen + 2) === "15");
  if (local15 !== undefined) national = national.slice(0, local15) + national.slice(local15 + 2);
  if (national.length < 10) return "Faltan dígitos: incluí el código de área y el número (ej. 11 2233 4455).";
  if (national.length > 12) return "Sobran dígitos: revisá que no hayas repetido el código de área o el 15.";
  return "No corresponde a un celular argentino. Revisá el código de área y el número.";
}

export function formatArMobile(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

// Parte nacional para prellenar el input (+5491122334455 -> 91122334455).
export function arMobileInputValue(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = e164.replace(/\D/g, "");
  return digits.startsWith("54") ? digits.slice(2) : digits;
}
