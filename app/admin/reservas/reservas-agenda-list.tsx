import Link from "next/link";
import { adminEmptyState } from "@/components/admin/admin-premium";

export type AgendaItemKind = "fixed" | "reservation" | "external";

export type AgendaItem = {
  key: string;
  time: string;
  courtName: string;
  label: string;
  kind: AgendaItemKind;
  matchId?: string;
};

const KIND_META: Record<AgendaItemKind, { badge: string; dot: string; text: string }> = {
  fixed: { badge: "Turno fijo", dot: "#0085FC", text: "text-[#0461C4]" },
  reservation: { badge: "Reserva", dot: "#22C55E", text: "text-[#15803D]" },
  external: { badge: "Bloqueado", dot: "#EF4444", text: "text-[#EF4444]" },
};

/**
 * Agenda cronológica simple del día — reemplaza la vieja grilla
 * (ReservasGridClient/AdminReservasMobileView) que dibujaba una fila por
 * cada horario "posible" cruzando todas las canchas. Esa grilla generaba
 * mala UX en cuanto dos canchas tenían franjas horarias distintas (ver fix
 * previo de buildSlotsForDay). La creación de reservas ya no depende de
 * verla vacía/ocupada — sale del flujo de "+ Nueva reserva"
 * (getAdminClubAvailability). Esta vista es solo lectura: lista lo que
 * realmente hay cargado ese día, ordenado por horario.
 */
export default function ReservasAgendaList({
  items,
  selectedDate,
}: {
  items: AgendaItem[];
  selectedDate: string;
}) {
  if (items.length === 0) {
    return <div className={adminEmptyState}>No hay reservas, turnos fijos ni bloqueos cargados para este día.</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const meta = KIND_META[item.kind];
        const content = (
          <div
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-200"
            style={{
              borderRadius: 10,
              borderLeft: `3px solid ${meta.dot}`,
              background:
                item.kind === "external" ? "rgba(239,68,68,0.08)" : item.kind === "fixed" ? "rgba(0,133,252,0.08)" : "rgba(34,197,94,0.08)",
            }}
          >
            <span className={`w-14 shrink-0 text-sm font-bold ${meta.text}`}>{item.time}</span>
            <span className="w-24 shrink-0 truncate text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {item.courtName}
            </span>
            <span className={`flex-1 truncate text-sm font-bold ${meta.text}`}>{item.label}</span>
            <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{meta.badge}</span>
          </div>
        );

        if (!item.matchId) {
          return <div key={item.key}>{content}</div>;
        }

        return (
          <Link
            key={item.key}
            href={`/admin/reservas?date=${selectedDate}&selected=${item.matchId}`}
            className="block hover:brightness-95"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
