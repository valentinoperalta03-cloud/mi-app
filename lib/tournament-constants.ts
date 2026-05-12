export const TOURNAMENT_PLATFORM_FEE_ARS = 1000;

export type TournamentTypeKey = "americano" | "eliminacion" | "grupos_eliminacion" | "mixing";

export const TOURNAMENT_TYPE_OPTIONS: { value: TournamentTypeKey; label: string; badge: string }[] = [
  { value: "americano", label: "Americano", badge: "🏆 Americano" },
  { value: "eliminacion", label: "Eliminación directa", badge: "⚡ Eliminación" },
  { value: "grupos_eliminacion", label: "Grupos + eliminación", badge: "🎯 Grupos" },
  { value: "mixing", label: "Mixing", badge: "🔀 Mixing" },
];

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  open: "Inscripción abierta",
  in_progress: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

export const MAX_PAIRS_OPTIONS = [8, 16, 32, 64] as const;
