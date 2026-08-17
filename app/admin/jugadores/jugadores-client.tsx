"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { adminInputClass, adminSelectClass } from "@/components/admin/admin-form-input";
import {
  adminBadgeBrand,
  adminBadgeSuccess,
  adminCard,
  adminCTADanger,
  adminEmptyState,
  adminKicker,
} from "@/components/admin/admin-premium";
import { AdminPressableSurface } from "@/components/admin/admin-pressable";
import { PlayerAvatar, PlayerSegmentPill } from "@/components/admin/admin-status-pills";
import { blockPlayerAction, unblockPlayerAction } from "./actions";

export type PlayerRow = {
  uid: string;
  name: string;
  avatarUrl: string | null;
  levelBadge: string;
  category: string;
  totalPlayed: number;
  reservationsCreated: number;
  last: string;
  segment: "Nuevo" | "Recurrente";
  cancellationCount: number;
  cancellationRate: number;
  favoriteSlot: string;
  favoriteDay: string | null;
  courtPosition: string;
  preferredHand: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
};

const CATEGORIES = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];
const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

type SortKey = "totalPlayed" | "last" | "cancellationRate" | "name";

function categoryLabel(row: Pick<PlayerRow, "levelBadge">) {
  return row.levelBadge === "Sin nivelar" ? "Sin categoría" : row.levelBadge;
}

export default function JugadoresClient({
  list,
  blockedUserIds,
}: {
  list: PlayerRow[];
  blockedUserIds: string[];
}) {
  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("totalPlayed");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);

  const hasActiveFilters = Boolean(search || segmentFilter || categoryFilter || dayFilter);

  function clearFilters() {
    setSearch("");
    setSegmentFilter("");
    setCategoryFilter("");
    setDayFilter("");
  }

  const filtered = useMemo(() => {
    return list
      .filter((row) => {
        if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (segmentFilter && row.segment !== segmentFilter) return false;
        if (categoryFilter && row.category !== categoryFilter) return false;
        if (dayFilter && row.favoriteDay !== dayFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "last") return parseISO(b.last).getTime() - parseISO(a.last).getTime();
        if (sortBy === "cancellationRate") return b.cancellationRate - a.cancellationRate;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return b.totalPlayed - a.totalPlayed;
      });
  }, [list, search, segmentFilter, categoryFilter, dayFilter, sortBy]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="search"
          placeholder="Buscar jugador..."
          className={adminInputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={adminSelectClass} value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="Nuevo">Nuevos</option>
          <option value="Recurrente">Recurrentes</option>
        </select>
        <select className={adminSelectClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select className={adminSelectClass} value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="">Cualquier día</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
        <select className={adminSelectClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="totalPlayed">Más activos</option>
          <option value="last">Última reserva</option>
          <option value="cancellationRate">Mayor cancelación</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      <p className="text-sm text-[var(--text-tertiary)]">
        {filtered.length} jugador{filtered.length !== 1 ? "es" : ""}
        {hasActiveFilters ? " encontrados" : ""}
      </p>

      {filtered.length === 0 ? (
        hasActiveFilters ? (
          <div className={adminEmptyState}>
            No hay jugadores que coincidan con los filtros.
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 block text-sm font-semibold text-[#0085FC]"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <p className={adminEmptyState}>Todavía no hay creadores de partidos en tus canchas.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => (
            <li key={row.uid}>
              <AdminPressableSurface>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(row)}
                  className={`flex w-full items-center gap-3 text-left ${adminCard}`}
                >
                  <PlayerAvatar name={row.name} avatarUrl={row.avatarUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--text-primary)]">{row.name}</p>
                    <p className="truncate text-xs text-[var(--text-tertiary)]">
                      {categoryLabel(row)} · {row.totalPlayed} partido{row.totalPlayed !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <PlayerSegmentPill segment={row.segment} />
                  <ChevronRight size={16} className="shrink-0 text-[var(--text-tertiary)]" />
                </button>
              </AdminPressableSurface>
            </li>
          ))}
        </ul>
      )}

      {selectedPlayer ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--bg-card)] p-6"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center gap-3">
              <PlayerAvatar name={selectedPlayer.name} avatarUrl={selectedPlayer.avatarUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-[var(--text-primary)]">{selectedPlayer.name}</p>
                <p className="truncate text-xs text-[var(--text-tertiary)]">
                  ID: {selectedPlayer.uid.slice(0, 8)}…
                </p>
              </div>
              <button type="button" onClick={() => setSelectedPlayer(null)} aria-label="Cerrar" className="shrink-0">
                <X size={20} className="text-[var(--text-tertiary)]" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
              <div>
                <dt className={adminKicker}>Categoría</dt>
                <dd className="mt-1">
                  {selectedPlayer.levelBadge === "Sin nivelar" ? (
                    <span className="font-semibold text-[var(--text-secondary)]">Sin categoría</span>
                  ) : (
                    <span className={adminBadgeBrand}>{selectedPlayer.levelBadge}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Segmento</dt>
                <dd className="mt-1">
                  <PlayerSegmentPill segment={selectedPlayer.segment} />
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Email</dt>
                <dd className="mt-1 truncate font-semibold text-[var(--text-secondary)]">
                  {selectedPlayer.email ?? "—"}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Teléfono</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{selectedPlayer.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className={adminKicker}>Ciudad</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                  {[selectedPlayer.city, selectedPlayer.province].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Reservas creadas</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{selectedPlayer.reservationsCreated}</dd>
              </div>
              <div>
                <dt className={adminKicker}>Partidos totales</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{selectedPlayer.totalPlayed}</dd>
              </div>
              <div>
                <dt className={adminKicker}>Última reserva</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                  {format(parseISO(selectedPlayer.last), "d MMM yyyy", { locale: es })}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Cancelaciones</dt>
                <dd
                  className={`mt-1 font-semibold ${
                    selectedPlayer.cancellationRate > 30
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {selectedPlayer.cancellationCount} ({selectedPlayer.cancellationRate}%)
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Horario favorito</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                  {selectedPlayer.favoriteSlot === "Sin historial" ? "Sin historial" : `${selectedPlayer.favoriteSlot}hs`}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Día favorito</dt>
                <dd className="mt-1 font-semibold capitalize text-[var(--text-secondary)]">
                  {selectedPlayer.favoriteDay ?? "—"}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Posición</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{selectedPlayer.courtPosition}</dd>
              </div>
              <div>
                <dt className={adminKicker}>Mano hábil</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                  {selectedPlayer.preferredHand ?? "No definida"}
                </dd>
              </div>
              <div>
                <dt className={adminKicker}>Estado</dt>
                <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                  {blockedSet.has(selectedPlayer.uid) ? "🚫 Bloqueado" : "✓ Activo"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
              {selectedPlayer.phone ? (
                <a
                  href={`https://wa.me/${selectedPlayer.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2.5 text-center text-sm font-semibold text-[var(--text-primary)]"
                >
                  💬 WhatsApp
                </a>
              ) : null}
              <Link
                href={`/admin/reservas?selected=&date=${format(parseISO(selectedPlayer.last), "yyyy-MM-dd")}`}
                className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2.5 text-center text-sm font-semibold text-[var(--text-primary)]"
              >
                Ver reservas
              </Link>
              {!blockedSet.has(selectedPlayer.uid) ? (
                <form action={blockPlayerAction} className="flex-1">
                  <input type="hidden" name="user_id" value={selectedPlayer.uid} />
                  <button type="submit" className={`w-full ${adminCTADanger}`}>
                    Bloquear
                  </button>
                </form>
              ) : (
                <form action={unblockPlayerAction} className="flex-1">
                  <input type="hidden" name="user_id" value={selectedPlayer.uid} />
                  <button type="submit" className={`w-full ${adminBadgeSuccess}`}>
                    Desbloquear
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
