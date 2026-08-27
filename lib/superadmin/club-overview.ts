/** Fila de `superadmin_clubs_overview` (vista analítica). */
export type SubscriptionStatus = "pending" | "trial" | "active" | "past_due" | "paused" | "trial_expired";

export type SuperadminClubOverview = {
  id: string;
  name: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  owner_id: string | null;
  club_created_at: string;
  is_active: boolean;
  onboarding_completed: boolean;
  mp_access_token: string | null;
  mp_connected: boolean;
  subscription_status: SubscriptionStatus | null;
  trial_end_date: string | null;
  next_billing_date: string | null;
  mp_subscription_id: string | null;
  owner_email: string | null;
  courts_count: number;
  reservations_total: number;
  reservations_this_month: number;
  open_matches_total: number;
  open_matches_this_month: number;
  revenue_paid_total: number;
  revenue_paid_this_month: number;
  last_reservation_date: string | null;
  unique_players_30d: number;
};

/** Precio fijo de la suscripción mensual B2B (ver app/api/mp/subscriptions/create). */
export const SUBSCRIPTION_PRICE_ARS = 50_000;

export function moneyArs(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export type BadgeTone = "ok" | "warn" | "danger" | "idle" | "info";

/** Salud general del club: primero si está deshabilitado, después su estado de suscripción. */
export function clubHealthLabel(row: Pick<SuperadminClubOverview, "is_active" | "subscription_status">): {
  tone: BadgeTone;
  label: string;
} {
  if (!row.is_active) return { tone: "danger", label: "Inactivo" };
  switch (row.subscription_status) {
    case "active":
      return { tone: "ok", label: "Al día" };
    case "trial":
      return { tone: "info", label: "En prueba" };
    case "pending":
      return { tone: "idle", label: "Sin activar" };
    case "past_due":
      return { tone: "danger", label: "Pago fallido" };
    case "paused":
      return { tone: "warn", label: "Pausado" };
    case "trial_expired":
      return { tone: "danger", label: "Trial vencido" };
    default:
      return { tone: "idle", label: "Sin datos" };
  }
}

/** Badge de la suscripción B2B en sí (usado en tabla de clubes y detalle). */
export function subscriptionBadge(
  row: Pick<SuperadminClubOverview, "subscription_status" | "trial_end_date">
): { tone: BadgeTone; label: string } {
  switch (row.subscription_status) {
    case "active":
      return { tone: "ok", label: "Activo" };
    case "trial": {
      const days = row.trial_end_date
        ? Math.ceil((new Date(row.trial_end_date).getTime() - Date.now()) / (24 * 3600 * 1000))
        : null;
      return {
        tone: "info",
        label: days !== null ? `Trial (${Math.max(days, 0)}d restantes)` : "Trial",
      };
    }
    case "past_due":
      return { tone: "danger", label: "Pago fallido" };
    case "paused":
      return { tone: "warn", label: "Pausado" };
    case "trial_expired":
      return { tone: "danger", label: "Trial vencido" };
    case "pending":
    default:
      return { tone: "idle", label: "Sin tarjeta" };
  }
}
