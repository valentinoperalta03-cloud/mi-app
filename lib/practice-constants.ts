export const PRACTICE_PLATFORM_FEE_RATE = 0.05;

export type PracticeRecurrenceKey = "once" | "weekly";
export type PracticeModalityKey = "individual" | "group";
export type PracticeStatusKey = "draft" | "open" | "finished" | "cancelled";

export const PRACTICE_RECURRENCE_OPTIONS: { value: PracticeRecurrenceKey; label: string }[] = [
  { value: "once", label: "Fecha única" },
  { value: "weekly", label: "Fecha fija (semanal)" },
];

export const PRACTICE_MODALITY_OPTIONS: { value: PracticeModalityKey; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "group", label: "Grupo" },
];

export const PRACTICE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  open: "Publicada",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

export const PRACTICE_SESSION_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

/** ISO weekday: 1 = lunes … 7 = domingo */
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

export const MAX_PRACTICE_WEEKS_AHEAD = 16;
