/** Fila de `superadmin_clubs_overview` (vista analítica). */
export type SuperadminClubOverview = {
  id: string;
  name: string | null;
  location: string | null;
  owner_id: string | null;
  club_created_at: string;
  is_active: boolean;
  onboarding_completed: boolean;
  mp_access_token: string | null;
  mp_connected: boolean;
  owner_email: string | null;
  courts_count: number;
  reservations_total: number;
  reservations_this_month: number;
  open_matches_total: number;
  open_matches_this_month: number;
  revenue_paid_total: number;
  revenue_paid_this_month: number;
  pending_debt: number;
  last_reservation_date: string | null;
  unique_players_30d: number;
};

export function moneyArs(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function clubHealthLabel(row: SuperadminClubOverview): {
  tone: "ok" | "warn" | "danger" | "idle";
  label: string;
} {
  if (!row.is_active) return { tone: "danger", label: "Inactivo" };
  if (Number(row.pending_debt) > 50_000) return { tone: "danger", label: "Deuda alta" };
  if (!row.mp_connected) return { tone: "warn", label: "Sin MP" };
  if (!row.onboarding_completed) return { tone: "warn", label: "Onboarding pendiente" };
  if (row.reservations_this_month === 0) {
    const last = row.last_reservation_date;
    if (!last) return { tone: "idle", label: "Sin actividad" };
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (new Date(last) < weekAgo) return { tone: "idle", label: "Inactivo +7d" };
  }
  return { tone: "ok", label: "Saludable" };
}
