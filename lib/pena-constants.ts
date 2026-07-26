import {
  adminBadgeBrand,
  adminBadgeDanger,
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgeSuccess,
} from "@/components/admin/admin-premium";

export type PenaStatus = "draft" | "published" | "in_progress" | "finished" | "cancelled";

export const PENA_STATUS_META: Record<PenaStatus, { label: string; className: string }> = {
  draft: { label: "Borrador", className: adminBadgeNeutral },
  published: { label: "Publicada", className: adminBadgeBrand },
  in_progress: { label: "En curso", className: adminBadgeLima },
  finished: { label: "Finalizada", className: adminBadgeSuccess },
  cancelled: { label: "Cancelada", className: adminBadgeDanger },
};

export function penaStatusMeta(status: string): { label: string; className: string } {
  return PENA_STATUS_META[status as PenaStatus] ?? { label: status, className: adminBadgeNeutral };
}

export const PENA_WHAT_INCLUDES_OPTIONS = [
  "Pizza",
  "Empanadas",
  "Hamburguesas",
  "Choripán",
  "Bebida",
  "Café",
  "Agua",
  "Nada",
] as const;

export const PENA_LEVEL_OPTIONS = [
  "8va",
  "7ma",
  "6ta",
  "5ta",
  "Suma 12",
  "Damas 6ta",
  "Caballeros 7ma",
  "Mixto",
] as const;

export const PENA_DURATION_OPTIONS = [90, 120, 150, 180] as const;

export const PENA_MAX_PLAYERS_OPTIONS = [8, 12, 16, 20, 24] as const;

export const PENA_CANCELLATION_HOURS_OPTIONS = [1, 3, 12, 24, 48] as const;

export const PENA_PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  cash: "Efectivo",
  transfer: "Transferencia",
};
