"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";
import EmptyStateCard from "@/components/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { cancelReservation, confirmFixedSlotAttendance, declineFixedSlotAttendance } from "./actions";

export type ReservationRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  total_price: number | null;
  match_status: string | null;
  financial_status: string | null;
  courts: { name: string | null; clubs: { name: string | null } | null } | null;
};

export type FixedSlotEntry = {
  matchId: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  courtName: string;
  clubName: string;
  attendanceStatus: string | null;
  deadlinePassed: boolean;
};

export type OpenMatchRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  match_status: string | null;
  match_type: string | null;
  courts: { name: string | null; clubs: { name: string | null } | null } | null;
};

type Tab = "canchas" | "partidos";

function ReservationCard({ row, showCancel }: { row: ReservationRow; showCancel: boolean }) {
  const club = row.courts?.clubs?.name ?? "Club";
  const court = row.courts?.name ?? "Cancha";
  const dateStr = row.scheduled_date ?? "";
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM yyyy", { locale: es })
      : "—";
  const hora = (row.scheduled_time ?? "").toString().trim().slice(0, 5);
  const dur = row.duration_minutes ?? 90;
  const precio = row.total_price != null ? `$${Math.round(Number(row.total_price)).toLocaleString("es-AR")}` : "—";
  const status = row.match_status ?? "";
  const financialStatus = row.financial_status ?? "unpaid";
  const badgeReserved = status === "reserved" && financialStatus !== "unpaid";
  const badgePending = status === "reserved" && financialStatus === "unpaid";
  const badgeCancelled = status === "cancelled";

  return (
    <article className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950">{club}</h2>
          <p className="truncate text-sm font-medium text-[var(--text-tertiary)]">{court}</p>
        </div>
        {badgeReserved ? (
          <Badge variant="success" className="shrink-0">
            Confirmada
          </Badge>
        ) : badgePending ? (
          <Badge variant="warning" className="shrink-0">
            Pendiente de pago
          </Badge>
        ) : badgeCancelled ? (
          <Badge variant="neutral" className="shrink-0">
            Cancelada
          </Badge>
        ) : (
          (() => {
            const normalized = (status || "").toLowerCase();
            if (normalized.includes("compet")) {
              return <Badge variant="brand">Competitivo</Badge>;
            }
            if (normalized.includes("amist")) {
              return <Badge variant="brand">Amistoso</Badge>;
            }
            if (normalized.includes("nivel")) {
              return <Badge variant="warning">Nivel restringido 🎯</Badge>;
            }
            return (
              <Badge variant="neutral" className="shrink-0">
                {status || "—"}
              </Badge>
            );
          })()
        )}
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-tertiary)]">
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Fecha</dt>
          <dd className="font-semibold capitalize text-[var(--text-primary)]">{fecha}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Hora</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{hora || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Duración</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{dur} min</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--text-tertiary)]">Precio</dt>
          <dd className="shrink-0 font-bold text-[#0085FC]">{precio}</dd>
        </div>
      </dl>
      {showCancel && status === "reserved" ? (
        <form action={cancelReservation} className="mt-4">
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="w-full rounded-2xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            Cancelar
          </button>
        </form>
      ) : null}
    </article>
  );
}

function FixedSlotCard({ slot }: { slot: FixedSlotEntry }) {
  const dateStr = slot.scheduledDate;
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM yyyy", { locale: es })
      : "—";
  const confirmed = slot.attendanceStatus === "confirmed";

  return (
    <article className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950">{slot.clubName}</h2>
          <p className="truncate text-sm font-medium text-[var(--text-tertiary)]">{slot.courtName}</p>
        </div>
        <Badge variant="brand" className="shrink-0">
          Turno fijo
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-[var(--text-tertiary)]">
        <div className="flex justify-between">
          <dt>Fecha</dt>
          <dd className="font-semibold capitalize text-[var(--text-primary)]">{fecha}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Hora</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{slot.scheduledTime}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Duración</dt>
          <dd className="font-semibold text-[var(--text-primary)]">{slot.durationMinutes} min</dd>
        </div>
      </dl>
      <div className="mt-4">
        {confirmed ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700">
            Confirmaste tu asistencia
          </p>
        ) : slot.deadlinePassed ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-500">
            Plazo de confirmación vencido
          </p>
        ) : (
          <div className="flex gap-2">
            <form action={confirmFixedSlotAttendance} className="flex-1">
              <input type="hidden" name="match_id" value={slot.matchId} />
              <button
                type="submit"
                className="w-full rounded-xl bg-[#0085FC] py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Confirmo asistencia
              </button>
            </form>
            <form action={declineFixedSlotAttendance} className="flex-1">
              <input type="hidden" name="match_id" value={slot.matchId} />
              <button
                type="submit"
                className="w-full rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                No voy
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

function OpenMatchCard({ match }: { match: OpenMatchRow }) {
  const clubName = match.courts?.clubs?.name ?? "Club";
  const courtName = match.courts?.name ?? "Cancha";
  const dateStr = match.scheduled_date ?? "";
  const fecha =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEE d MMM yyyy", { locale: es })
      : "—";
  const hora = (match.scheduled_time ?? "").toString().trim().slice(0, 5);

  return (
    <article className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{clubName}</p>
          <p className="text-sm text-[var(--text-tertiary)]">{courtName}</p>
        </div>
        <Badge variant="brand">Partido</Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-[var(--text-tertiary)]">
          {fecha} · {hora || "—"}
        </span>
        <Link href={`/partidos/${match.id}`} className="font-semibold text-[#0085FC]">
          Ver partido →
        </Link>
      </div>
    </article>
  );
}

type Props = {
  defaultTab: Tab;
  fixedSlots: FixedSlotEntry[];
  upcoming: ReservationRow[];
  pending: ReservationRow[];
  history: ReservationRow[];
  hasAnyReservation: boolean;
  openMatches: OpenMatchRow[];
};

export default function ReservasTabs({
  defaultTab,
  fixedSlots,
  upcoming,
  pending,
  history,
  hasAnyReservation,
  openMatches,
}: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="space-y-6">
      <div className="flex rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
        <button
          type="button"
          onClick={() => setTab("canchas")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            tab === "canchas"
              ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-tertiary)]"
          }`}
        >
          Canchas
        </button>
        <button
          type="button"
          onClick={() => setTab("partidos")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            tab === "partidos"
              ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-tertiary)]"
          }`}
        >
          Partidos{openMatches.length > 0 ? ` (${openMatches.length})` : ""}
        </button>
      </div>

      {tab === "canchas" ? (
        <div className="space-y-6">
          {!hasAnyReservation ? (
            <EmptyStateCard
              icon="calendar"
              title="Todavía no reservaste ninguna cancha"
              subtitle="Explorá clubes y reservá tu próximo turno"
              ctaHref="/clubes"
              ctaLabel="Explorar clubes"
            />
          ) : null}

          {fixedSlots.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Turnos fijos
              </h2>
              <div className="space-y-3">
                {fixedSlots.map((slot) => (
                  <FixedSlotCard key={slot.matchId} slot={slot} />
                ))}
              </div>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Próximas</h2>
              <div className="space-y-3">
                {upcoming.map((r) => (
                  <ReservationCard key={r.id} row={r} showCancel />
                ))}
              </div>
            </section>
          ) : null}

          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Pendientes de pago
              </h2>
              <div className="space-y-3">
                {pending.map((r) => (
                  <ReservationCard key={r.id} row={r} showCancel />
                ))}
              </div>
            </section>
          ) : null}

          {history.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Historial
              </h2>
              <div className="space-y-3">
                {history.map((r) => (
                  <ReservationCard key={r.id} row={r} showCancel={false} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {openMatches.length === 0 ? (
            <EmptyStateCard
              icon="users"
              title="No estás en ningún partido abierto"
              subtitle="Buscá un partido abierto y sumate a jugar"
              ctaHref="/buscar-partido"
              ctaLabel="Buscar partido"
            />
          ) : (
            openMatches.map((match) => <OpenMatchCard key={match.id} match={match} />)
          )}
        </div>
      )}
    </div>
  );
}
