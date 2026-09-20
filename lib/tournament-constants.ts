export type TournamentTypeKey = "americano" | "eliminacion" | "zonas" | "pena";

export const TOURNAMENT_TYPE_OPTIONS: {
  value: TournamentTypeKey;
  label: string;
  subtitle: string;
  badge: string;
}[] = [
  { value: "americano", label: "Americano", subtitle: "Todos contra todos, ranking por puntos.", badge: "🏆 Americano" },
  {
    value: "eliminacion",
    label: "Eliminación directa",
    subtitle: "Los ganadores avanzan hasta la final.",
    badge: "⚡ Eliminación",
  },
  {
    value: "zonas",
    label: "Zonas + eliminación",
    subtitle: "Fase de grupos, clasificación y cuadro final.",
    badge: "🎯 Zonas",
  },
  { value: "pena", label: "Peña", subtitle: "Formato social con comida y bebida incluida.", badge: "🎉 Peña" },
];

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  open: "Inscripción abierta",
  registration_closed: "Inscripciones cerradas",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const MAX_PAIRS_OPTIONS = [8, 16, 32, 64] as const;

/** Máximo de jugadores para peña (inscripción individual, no por pareja). Todos pares para poder formar parejas. */
export const PENA_MAX_PLAYERS_OPTIONS = [8, 12, 16, 20, 24] as const;

/** Opciones de "qué incluye" para torneos de tipo peña. */
export const PENA_WHAT_INCLUDES_OPTIONS = ["Pizza", "Empanadas", "Hamburguesas", "Choripán", "Bebida", "Café", "Agua"] as const;
