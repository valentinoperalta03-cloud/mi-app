export type CancellationPreset = {
  value: string;
  label: string;
  policy: string;
  hours: number;
  description: string;
};

export const CANCELLATION_POLICY_PRESETS: CancellationPreset[] = [
  {
    value: "0",
    label: "Sin reembolso",
    policy: "Sin reembolso",
    hours: 0,
    description: "No se realizan reembolsos por cancelaciones.",
  },
  {
    value: "2",
    label: "Reembolso hasta 2hs antes",
    policy: "Reembolso hasta 2 horas antes del turno",
    hours: 2,
    description: "El jugador puede cancelar con reembolso hasta 2 horas antes del horario reservado.",
  },
  {
    value: "6",
    label: "Reembolso hasta 6hs antes",
    policy: "Reembolso hasta 6 horas antes del turno",
    hours: 6,
    description: "El jugador puede cancelar con reembolso hasta 6 horas antes del horario reservado.",
  },
  {
    value: "12",
    label: "Reembolso hasta 12hs antes",
    policy: "Reembolso hasta 12 horas antes del turno",
    hours: 12,
    description: "El jugador puede cancelar con reembolso hasta 12 horas antes del horario reservado.",
  },
  {
    value: "24",
    label: "Reembolso hasta 24hs antes",
    policy: "Reembolso hasta 24 horas antes del turno",
    hours: 24,
    description: "El jugador puede cancelar con reembolso hasta 24 horas antes del horario reservado.",
  },
  {
    value: "48",
    label: "Reembolso hasta 48hs antes",
    policy: "Reembolso hasta 48 horas antes del turno",
    hours: 48,
    description: "El jugador puede cancelar con reembolso hasta 48 horas antes del horario reservado.",
  },
];

export function resolveCancellationPresetValue(
  policy: string | null | undefined,
  hours: number | null | undefined
): string {
  if (typeof hours === "number" && Number.isFinite(hours)) {
    const byHours = CANCELLATION_POLICY_PRESETS.find((p) => p.hours === hours);
    if (byHours) return byHours.value;
  }
  const normalized = String(policy ?? "").trim().toLowerCase();
  if (normalized.includes("sin reembolso")) return "0";
  if (normalized.includes("48")) return "48";
  if (normalized.includes("24")) return "24";
  if (normalized.includes("12")) return "12";
  if (normalized.includes("6")) return "6";
  if (normalized.includes("2")) return "2";
  return "24";
}

export function presetFromValue(value: string): CancellationPreset {
  return CANCELLATION_POLICY_PRESETS.find((p) => p.value === value) ?? CANCELLATION_POLICY_PRESETS[4]!;
}
