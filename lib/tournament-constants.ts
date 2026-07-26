export type TournamentTypeKey = "americano" | "eliminacion" | "pena";

export const TOURNAMENT_TYPE_OPTIONS: { value: TournamentTypeKey; label: string; badge: string }[] = [
  { value: "americano", label: "Americano", badge: "🏆 Americano" },
  { value: "eliminacion", label: "Eliminación directa", badge: "⚡ Eliminación" },
  { value: "pena", label: "Peña", badge: "🎉 Peña" },
];

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  open: "Inscripción abierta",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const MAX_PAIRS_OPTIONS = [8, 16, 32, 64] as const;

/** Opciones de "qué incluye" para torneos de tipo peña. */
export const PENA_WHAT_INCLUDES_OPTIONS = ["Pizza", "Empanadas", "Hamburguesas", "Choripán", "Bebida", "Café", "Agua"] as const;
