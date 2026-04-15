/**
 * Convierte valores legacy de “perfil nivelado” a boolean (p. ej. migraciones antiguas).
 * La tabla `profiles` actual no usa `is_leveled`; preferí `level_of_play` en queries nuevas.
 *
 * Orden:
 * 1. Si PostgREST devuelve `boolean` (columna `boolean` en Postgres), se usa tal cual.
 * 2. Valores nulos / ausentes → `false`.
 * 3. Legado: número 1/0 o strings tipo `"true"` / `"t"` (p. ej. columna TEXT antigua).
 */
export function toIsLeveledBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value === 1;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "t" || s === "1" || s === "yes";
  }
  return false;
}
