export type MatchVisibility = "publico" | "privado";

/** Normaliza el valor de `matches.visibility` a publico | privado. */
export function normalizeMatchVisibility(raw: string | null | undefined): MatchVisibility {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (v === "privado" || v === "private" || v === "privada") return "privado";
  return "publico";
}

export function isMatchPrivate(raw: string | null | undefined): boolean {
  return normalizeMatchVisibility(raw) === "privado";
}
