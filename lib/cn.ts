/** Une clases condicionales sin dependencias extra. */
export function cn(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}
